from fastapi import FastAPI
from socketio import AsyncServer    # Asycn Socket.IO server
from socketio.asgi import ASGIApp  # Wrap server as ASGI app
import random, asyncio, time
from fastapi.middleware.cors import CORSMiddleware

# FastAPI app
api = FastAPI(
    title = "Lobby Service",
    version = "1.0.0",
    description = "Service to manage game lobbies for Drawn to Chaos"
)

api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SocketIO server with ASGI and CORS allowed origins
sio = AsyncServer(async_mode = "asgi", cors_allowed_origins = "*")

# Combine SocketIO with FastAPI as ASGI app
app = ASGIApp(sio, other_asgi_app = api)

# In-memory storage for game stuff and lobbies
lobbies = {}
games = {}
WORDPOOL = [
    "sun", "moon", "cloud", "car", "house", "book", "phone", "chair",
    "tree", "clock", "cat", "dog", "fish", "bird", "turtle", "snake",
    "elephant", "butterfly", "rabbit", "lion", "pizza", "apple", "ice cream",
    "donut", "cake", "burger", "sandwich", "cookie", "banana", "coffee",
    "ball", "rainbow", "star", "rocket", "flower", "heart", "guitar",
    "camera", "boat", "robot"
    ]
REVEALDURATION = 7
DRAWDURATION = 45
GUESSDURATION = 25

POWERUPICON = "⭐"

# Get or create lobby data structure
def getLobby(lobbyName):
    # If lobby name not taken -> create new lobby
    if lobbyName not in lobbies:
        lobbies[lobbyName] = {"max": 6, "players": []}
    return lobbies[lobbyName]

# Push current lobby state to all connected users
async def broadcastLobby(lobbyName):
    # Get lobby data
    lobby = lobbies.get(lobbyName)
    if not lobby:
        return
    
    payload = {
        "lobbyName": lobbyName,
        "max": lobby["max"],
        "players": [{"sid": p["sid"], "name": p["name"]} for p in lobby["players"]]
    }
    
    # Broadcast to all in the lobby room
    await sio.emit("lobbyUpdate", payload, room = lobbyName)
    
async def startRound(lobbyName):
    game = games.get(lobbyName)
    lobby = lobbies.get(lobbyName)
    if not game or not lobby:
        return
    
    game["guessingStarted"] = False  # Reset guessing state
    
    roundNum = game.get("round", 1)
    print(f"Starting round {roundNum} for lobby '{lobbyName}'")
    
    # Choose random words for each player
    words = {}
    usedWords = game.get("usedWords", set())
    availableWords = [word for word in WORDPOOL if word not in usedWords]
    if len(availableWords) < len(lobby["players"]):
        availableWords = WORDPOOL.copy()
        usedWords.clear()
        
    for player in lobby["players"]:
        word = random.choice(WORDPOOL)
        words[player["sid"]] = word
        usedWords.add(word)
        
    game["usedWords"] = usedWords

    # Compute synced timestamps
    now = time.time()
    revealEnd = (now + REVEALDURATION) * 1000
    drawEnd = (now + REVEALDURATION + DRAWDURATION) * 1000
    
    # Save in game state
    game["words"] = words
    game["revealEnd"] = revealEnd
    game["drawEnd"] = drawEnd
    game["drawings"] = {}
    game["drawingOrder"] = []
    
    # Random powerup
    if random.random() < 0.8:
        icon = POWERUPICON
        x, y = random.randint(10, 90), random.randint(10, 90)
        game["powerup"] = {"icon": icon, "x": x, "y": y, "claimed": False}
    else:
        game["powerup"] = None
    
    # Build readable leaderboard
    players = []
    for p in lobby["players"]:
        sid = p["sid"]
        players.append({
            "sid": sid,
            "name": p["name"],
            "score": game["points"].get(sid, 0)
        })
    players.sort(key=lambda x: x["score"], reverse=True)
    
    # Emit to all players to start the round
    await sio.emit("roundBegin", {"round": roundNum, "words": words, "revealEnd": revealEnd, "drawEnd": drawEnd, "players": players, "powerup": game["powerup"]}, room = lobbyName)
    
    waitTime = REVEALDURATION + DRAWDURATION
    for _ in range(waitTime * 10):
        if len(game.get("drawings", {})) >= len(lobby["players"]):
            break
        await asyncio.sleep(0.1)
    
    # After waiting for all drawings or timeout
    if len(game.get("drawings", {})) >= 1:
        # Trigger guessing phase only if it hasn't started
        if not game.get("guessingStarted"):
            game["guessingStarted"] = True
            await showDrawings(lobbyName)
    else:
        print(f"No drawings received for lobby '{lobbyName}'")
      
    # Move to round summary
    await endRound(lobbyName)
    
async def endRound(lobbyName):
    game = games.get(lobbyName)
    lobby = lobbies.get(lobbyName)
    if not game or not lobby:
        return
    
    currentRound = game.get("round", 1)
    maxRounds = game.get("maxRounds", 3)
    
    # Build readable leaderboard
    players = []
    for p in lobby["players"]:
        sid = p["sid"]
        players.append({
            "sid": sid,
            "name": p["name"],
            "score": game["points"].get(sid, 0)
        })
    players.sort(key=lambda x: x["score"], reverse=True)
    
    # Notify clients to show leaderboard/game summary
    await sio.emit("roundSummary", {"round": currentRound, "players": players}, room = lobbyName)
    
    # Wait 5 seconds before starting next round
    await asyncio.sleep(5)
    
    if currentRound < maxRounds:
        game["round"] += 1
        game["guessingStarted"] = False 
        game["correctGuessers"] = set()
        await startRound(lobbyName)
    else:
        # Game over
        await sio.emit("gameOver", {"players": lobbies[lobbyName]["players"]}, room = lobbyName)
        
        del games[lobbyName]  # Clean up game state
    
# Broadcast updated leaderboard
async def broadcastPoints(lobbyName):
    game = games.get(lobbyName)
    lobby = lobbies.get(lobbyName)
    if not game or not lobby:
        return
    
    players = []
    for p in lobby["players"]:
        sid = p["sid"]
        players.append({
            "sid": sid,
            "name": p["name"],
            "score": game["points"].get(sid, 0)
        })
        
    players.sort(key=lambda x: x["score"], reverse=True)
    await sio.emit("updatePoints", {"players": players}, room = lobbyName)
    
# Show each drawing for guessing phase
async def showDrawings(lobbyName):
    lobbyName = lobbyName.strip().lower()
    lobby = lobbies.get(lobbyName)
    if not lobby:
        return
    
    game = games.get(lobbyName)
    if not game or "drawings" not in game:
        return
    
    print(f"Starting guessing phase for lobby '{lobbyName}'")
    
    hintRecievers = game.get("nextRoundHints", set())
    for sid in hintRecievers:
        currentDrawerSid = game.get("currentDrawerSid")
        correctWord = game["words"].get(currentDrawerSid, "")
        if correctWord:
            hintLetter = random.choice(correctWord)
            await sio.emit("receiveHint", {"letter": hintLetter}, to = sid)
    
    # Iterate over each image
    for drawerSid in game.get("drawingOrder", []):
        game["corerctGuesses"] = set()
        game["currentDrawerSid"] = drawerSid
        image = game["drawings"].get(drawerSid)
        playerName = next((p["name"] for p in lobbies[lobbyName]["players"] if p["sid"] == drawerSid), "Unknown")

        duration = GUESSDURATION
        endTime = int(time.time() * 1000) + duration * 1000
        
        game["currentDrawer"] = drawerSid
        
        correctWord = game["words"].get(drawerSid, "")
        await sio.emit("showDrawing", {"drawer": playerName, "drawerSid": drawerSid, "image": image, "duration": duration, "endTime": endTime, "wordLength": len(correctWord)}, room = lobbyName)
        
        print(f"Showing drawing by {playerName}")
        await asyncio.sleep(duration) # Wait duration seconds before next drawing
        
# Handle user connecting
@sio.event
async def connect(sid, environ):
    print(f"User connected: {sid}")

# Handle user disconnecting
@sio.event
async def disconnect(sid, reason):
    print(f"User disconnected: {sid}")
    
    # Find and remove player from any lobby they were in
    toDelete = []
    for lobbyName, lobby in lobbies.items():
        before = len(lobby["players"])
        lobby["players"] = [p for p in lobby["players"] if p["sid"] != sid]
        after = len(lobby["players"])
        
        # If nomore players in lobby then mark for deletion elseif broadcast update to lobby
        if after == 0:
            toDelete.append(lobbyName)
        elif before != after:
            await broadcastLobby(lobbyName)
    
    # Delete empty lobbies
    for lobbyName in toDelete:
        del lobbies[lobbyName]
        
# Handle creating a lobby
@sio.event
async def createLobby(sid, data):
    print("Create lobby data:", data)
    name = (data or {}).get("name", "").strip()
    lobbyName = (data or {}).get("lobbyName", "").strip().lower()

    if not name or not lobbyName:
        await sio.emit("joinError", {"message": "Invalid name or lobby name."}, to = sid)
        return
    
    lobby = getLobby(lobbyName)
    
    # Enforce capacity
    if len(lobby["players"]) >= lobby["max"]:
        await sio.emit("lobbyFull", {"lobbyName": lobbyName}, to = sid)
        return

    # Join SocketIO room for this lobby
    await sio.enter_room(sid, lobbyName)
    
    # Add player to lobby
    lobby["players"].append({"sid": sid, "name": name})
    
    # Tell all in lobby the updated state
    await broadcastLobby(lobbyName)
    
    print(f"Lobby '{lobbyName}' created by {name} ({sid})")

# Joining existing lobby
@sio.event
async def joinLobby(sid, data):
    name = (data or {}).get("name", "").strip()
    lobbyName = (data or {}).get("lobbyName", "").strip().lower()
    
    lobby = lobbies.get(lobbyName)
    
    # Check if lobby exists
    if not lobby:
        await sio.emit("joinError", {"message": f"Lobby '{lobbyName}' does not exist."}, to = sid)
        return
    
    # Prevent duplicate names in same lobby
    if any(p["name"] == name for p in lobby["players"]):
        await sio.emit("joinError", {"message": "Name already taken in this lobby."}, to = sid)
        return
    
    # Capacity check
    if len(lobby["players"]) >= lobby["max"]:
        await sio.emit("lobbyFull", {"lobbyName": lobbyName}, to = sid)
        return
    
    # Join SocketIO room for this lobby
    await sio.enter_room(sid, lobbyName)
    
    # Add player to lobby
    lobby["players"].append({"sid": sid, "name": name})
    
    await broadcastLobby(lobbyName)
    
# Leaving a lobby
@sio.event
async def leaveLobby(sid, data):
    lobbyName = (data or {}).get("lobbyName", "").strip().lower()
    lobby = lobbies.get(lobbyName)
    if not lobby:
        return
    
    # Remove player and leave room
    lobby["players"] = [p for p in lobby["players"] if p["sid"] != sid]
    await sio.leave_room(sid, lobbyName)
    
    # If lobby is empty clean up else broadcast update
    if len(lobby["players"]) == 0:
        del lobbies[lobbyName]
    else:
        await broadcastLobby(lobbyName)
        
# Get lobby state
@sio.event
async def getLobbyState(sid, data):
    lobbyName = (data or {}).get("lobbyName", "").strip().lower()
    await broadcastLobby(lobbyName)
    
# Start game event triggered by host
@sio.event
async def startGame(sid, data):
    lobbyName = (data or {}).get("lobbyName", "").strip().lower()
    if not lobbyName or lobbyName not in lobbies:
        return

    lobby = lobbies[lobbyName]
    print(f"Initializing game for {lobbyName}")

    # Create a new game object
    await broadcastPoints(lobbyName)
    games[lobbyName] = {
        "round": 1,
        "maxRounds": 3,
        "points": {p["sid"]: 0 for p in lobby["players"]},
        "usedWords": set()
    }
    
    await sio.emit("gameInit", {"lobbyName": lobbyName, "players": [{"sid": p["sid"], "name": p["name"]} for p in lobby["players"]]}, room = lobbyName)
    await asyncio.sleep(2)  # Give time for clients to prepare
    await startRound(lobbyName)

    
# Submit drawing event
@sio.event
async def submitDrawing(sid, data):
    lobbyName = (data or {}).get("lobbyName", "").strip().lower()
    imageData = (data or {}).get("image", "")
    
    if not lobbyName or not imageData:
        await sio.emit("error", {"message": "Invalid drawing submission."}, to = sid)
        return
    
    game = games.get(lobbyName)
    if not game:
        await sio.emit("error", {"message": "Game not found for this lobby."}, to = sid)
        return
    
    # Save player's image
    if "drawings" not in game:
        game["drawings"] = {}
    game["drawings"][sid] = imageData
    if "drawingOrder" not in game:
        game["drawingOrder"] = []
    if sid not in game["drawingOrder"]:
        game["drawingOrder"].append(sid)
    
    # If all players have submitted their drawings go to next step
    if len(game["drawings"]) == len(game["points"]):
        print(f"All drawings submitted for lobby '{lobbyName}'")
        await sio.emit("roundEnd", {"round": game["round"], "message": "All drawings recieved"}, room = lobbyName)
        
        # Wait 1 seconds, then start showing drawings
        await asyncio.sleep(1)
        if not game.get("guessingStarted"):
            game["guessingStarted"] = True
            await showDrawings(lobbyName)
            
# Powerup event
@sio.event
async def collectPowerup(sid, data):
    lobbyName = (data or {}).get("lobbyName", "").strip().lower()
    game = games.get(lobbyName)
    if not game or not game.get("powerup"):
        return
    
    powerup = game["powerup"]
    if powerup.get("claimed"):
        return  # already taken

    # Mark as claimed
    powerup["claimed"] = True
    powerup["owner"] = sid
    
    game.setdefault("nextRoundHints", set()).add(sid)
    
# Guess handling event
@sio.event
async def submitGuess(sid, data):
    lobbyName = (data or {}).get("lobbyName", "").strip().lower()
    guess = (data or {}).get("guess", "").strip().lower()
    if not lobbyName or not guess:
        return
    
    game = games.get(lobbyName)
    lobby = lobbies.get(lobbyName)
    if not game or not lobby or "drawings" not in game:
        return
    
    # Find correct word (current drawer's word)
    currentDrawerSid = game.get("currentDrawerSid")
    correctWord = game["words"].get(currentDrawerSid, "").lower()
    
    # Prevent drawer from guessing their own word
    if sid == currentDrawerSid:
        await sio.emit("chatMessage", {"from": "System", "text": "You’re the drawer! You can’t guess your own word."}, to = sid)
        return
    
    playerName = next((p["name"] for p in lobby["players"] if p["sid"] == sid), "Someone")
    
    # If guess is correct
    if guess == correctWord:
        # Prevent double scoring
        if sid in game.get("correctGuessers", set()):
            await sio.emit("chatMessage", {"from": "System", "text": "You already guessed this word!"}, to=sid)
            return

        game.setdefault("correctGuessers", set()).add(sid)
        
        playerName = next((p["name"] for p in lobby["players"] if p["sid"] == sid), "Someone")
        game["points"][sid] = game["points"].get(sid, 0) + 10
        await broadcastPoints(lobbyName)
        
        # Notify only the correct guesser
        await sio.emit("chatMessage", {"from": "System", "text": f"You guessed it! The word was '{correctWord}'"}, to = sid)
        
        # Notify everyone else
        await sio.emit("chatMessage", {"from": "System", "text": f"{playerName} guessed the word!"}, skip_sid = sid, room = lobbyName)
        
        return
        
    # If guess incorrect broadcast it to everyone
    await sio.emit("chatMessage", {"from": playerName, "text": guess}, room = lobbyName)