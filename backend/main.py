from fastapi import FastAPI
from socketio import AsyncServer    # Asycn Socket.IO server
from socketio.asgi import ASGIApp  # Wrap server as ASGI app
import random, asyncio

# FastAPI app
api = FastAPI(
    title = "Lobby Service",
    version = "1.0.0",
    description = "Service to manage game lobbies for Drawn to Chaos"
)

# SocketIO server with ASGI and CORS allowed origins
sio = AsyncServer(async_mode = "asgi", cors_allowed_origins = "*")

# Combine SocketIO with FastAPI as ASGI app
app = ASGIApp(sio, other_asgi_app = api)

# In-memory storage for game stuff and lobbies
lobbies = {}
games = {}
WORDPOOL = ["apple", "cat", "house", "car", "phone", "book", "airplane", "castle", "sun", "moon"]

# Get or create lobby data structure
def getLobby(lobbyName):
    # If lobby name not taken -> create new lobby
    if lobbyName not in lobbies:
        lobbies[lobbyName] = {"max": 2, "players": []}
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
    lobbyName = (data or {}).get("lobbyName", "").strip()
    
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
    lobbyName = (data or {}).get("lobbyName", "").strip()
    
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
    lobbyName = (data or {}).get("lobbyName", "")
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
    lobbyName = (data or {}).get("lobbyName", "")
    await broadcastLobby(lobbyName)
    
# Start game event triggered by host
@sio.event
async def startGame(sid, data):
    lobbyName = (data or {}).get("lobbyName", "")
    lobby = lobbies.get(lobbyName)
    if not lobby:
        await sio.emit("joinError", {"message": "Lobby does not exist."}, to = sid)
        return
    
    # Verify host
    if len(lobby["players"]) > 0 and lobby["players"][0]["sid"] != sid:
        await sio.emit("joinError", {"message": "Only the host can start the game."}, to = sid)
        return
    
    # Build initial game state
    words = random.sample(WORDPOOL, len(lobby["players"]))
    sabatageTimes = [random.randint(10, 50) for _ in range(3)]
    
    games[lobbyName] = {
        "round": 1,
        "maxRounds": 3,
        "points": {p["sid"]: 0 for p in lobby["players"]},
        "words": {p["sid"]: words[i] for i, p in enumerate(lobby["players"])},
        "sabatageTimes": sabatageTimes
    }
    
    print(f"Initializing game for {lobbyName} -> {games[lobbyName]}")
    await sio.emit("gameInit", {"message": "Setting up game..."}, room = lobbyName)
    
    # Wait a moment to ensure setup
    await asyncio.sleep(2)
    
    await sio.emit("roundBegin", {"round": 1, "words": games[lobbyName]["words"]}, room = lobbyName)