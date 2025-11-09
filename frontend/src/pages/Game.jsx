import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket/socket.js";
import HandCanvas from "../components/HandCanvas.jsx";
import Logo from "../assets/logo.png";

const Game = ({ me, onLeave }) => {
	const [phase, setPhase] = useState("loading");
	const [word, setWord] = useState(null);
	const [round, setRound] = useState(0);
	const [timer, setTimer] = useState(0);
	const [leaderboard, setLeaderboard] = useState([]);
	const [wordLength, setWordLength] = useState(0);
	const [roundPowerup, setRoundPowerup] = useState(null);

	const [revealEnd, setRevealEnd] = useState(null);
	const [drawEnd, setDrawEnd] = useState(null);
	const [endTime, setEndTime] = useState(null);
	const [guessTimer, setGuessTimer] = useState(0);

	const [currentImage, setCurrentImage] = useState(null);
	const [currentDrawer, setCurrentDrawer] = useState(null);
	const handCanvasRef = useRef(null);

	const [chatInput, setChatInput] = useState("");
	const [chatMessages, setChatMessages] = useState([]);

	const navigate = useNavigate();

	const messagesEndRef = useRef(null);

	useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
		}
	}, [chatMessages]);

	// Game initialization and round start
	useEffect(() => {
		socket.on("gameInit", (data) => {
			const players = data.players || me?.lobbyPlayers || [];
			setLeaderboard(players.map((p) => ({ name: p.name, score: 0 })));
			setPhase("loading");
		});

		socket.on("roundBegin", (data) => {
			setRound(data.round);
			setWord(data.words[socket.id]);
			setRevealEnd(data.revealEnd);
			setDrawEnd(data.drawEnd);
			setPhase("wordReveal");
			setChatMessages([]);
			setRoundPowerup(data.powerup || null);
			if (data.players) {
				setLeaderboard(
					data.players.map((p) => ({ name: p.name, score: p.score || 0 }))
				);
			}
		});

		return () => {
			socket.off("gameInit");
			socket.off("roundBegin");
		};
	}, []);

	// Word reveal timer
	useEffect(() => {
		if (phase !== "wordReveal" || !revealEnd) return;

		const interval = setInterval(() => {
			const timeLeft = Math.max(0, Math.floor((revealEnd - Date.now()) / 1000));
			setTimer(timeLeft);
			if (timeLeft <= 0) {
				clearInterval(interval);
				setPhase("drawing");
			}
		}, 250);

		return () => clearInterval(interval);
	}, [phase, revealEnd]);

	// 60 second drawing timer
	useEffect(() => {
		if (phase !== "drawing" || !drawEnd) return;
		const interval = setInterval(() => {
			const timeLeft = Math.max(0, Math.floor((drawEnd - Date.now()) / 1000));
			setTimer(timeLeft);
			if (timeLeft <= 0) {
				clearInterval(interval);
				const imageData = handCanvasRef.current?.getImage();
				socket.emit("submitDrawing", {
					lobbyName: me.lobbyName,
					image: imageData,
				});
				setPhase("waitingForGuessing");
			}
		}, 250);
		return () => clearInterval(interval);
	}, [phase, drawEnd]);

	// Guessing phase timer
	useEffect(() => {
		if (phase !== "guessing" || !endTime) return;

		// Clear any previous intervals before setting a new one
		setGuessTimer(Math.max(0, Math.floor((endTime - Date.now()) / 1000)));

		const interval = setInterval(() => {
			const timeLeft = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
			setGuessTimer(timeLeft);
			if (timeLeft <= 0) {
				clearInterval(interval);
				setPhase("roundEnd");
			}
		}, 1000);

		return () => clearInterval(interval);
	}, [endTime]);

	useEffect(() => {
		if (phase !== "roundSummary") return;
		const interval = setInterval(() => {
			setTimer((prev) => Math.max(0, prev - 1));
		}, 1000);
		return () => clearInterval(interval);
	}, [phase]);

	// Drawing display and chat
	useEffect(() => {
		socket.on("showDrawing", (data) => {
			setCurrentImage(data.image);
			setCurrentDrawer(data.drawerSid);
			setEndTime(data.endTime);
			setWordLength(data.wordLength || 0);
			setPhase("guessing");
		});

		socket.on("chatMessage", (msg) =>
			setChatMessages((prev) => [...prev, msg])
		);

		socket.on("updatePoints", (data) => {
			if (data?.players?.length) setLeaderboard(data.players);
		});

		return () => {
			socket.off("showDrawing");
			socket.off("chatMessage");
			socket.off("updatePoints");
		};
	}, []);

	// Round end and game over
	useEffect(() => {
		socket.on("roundSummary", (data) => {
			setLeaderboard(data.players || []);
			setTimer(5);
			setPhase("roundSummary");
		});

		socket.on("gameOver", () => {
			setPhase("gameOver");
		});

		return () => {
			socket.off("roundSummary");
			socket.off("gameOver");
		};
	}, []);

	// Loading screen
	if (phase === "loading") {
		return (
			<div className="min-h-screen bg-white flex flex-col items-center justify-center gap-6">
				<img
					src={Logo}
					alt="Drawn to Chaos"
					className="w-64 h-auto animate-pulse"
				/>
				<h1 className="text-3xl font-bold text-gray-800 animate-pulse">
					Loading game...
				</h1>
			</div>
		);
	}

	// Word reveal screen
	if (phase === "wordReveal") {
		return (
			<div className="min-h-screen bg-purple-50 flex items-center justify-center p-8">
				<div className="bg-white rounded-2xl shadow-2xl p-12 border-2 border-gray-200 max-w-2xl text-center">
					<h1 className="text-4xl font-bold text-gray-800 mb-6">
						Round {round}
					</h1>

					<div className="bg-purple-100 rounded-lg p-8 mb-8">
						<p className="text-xl text-gray-700 mb-3">Your word is</p>
						<p className="text-5xl font-bold text-purple-600">{word}</p>
					</div>

					<div className="text-7xl font-bold text-gray-800 mb-4">{timer}</div>
					<p className="text-gray-600 text-lg">Get ready to draw!</p>
				</div>
			</div>
		);
	}

	// Drawing screen
	if (phase === "drawing") {
		return (
			<div className="min-h-screen bg-white flex">
				{/* Sidebar */}
				<div className="w-80 bg-purple-50 p-6 border-r-2 border-gray-200">
					<h2 className="text-2xl font-bold text-gray-800 mb-6">Leaderboard</h2>

					<div className="space-y-3 mb-6">
						{leaderboard.map((p, idx) => (
							<div
								key={p.name}
								className="bg-white rounded-lg px-4 py-3 shadow-md border border-gray-200 flex justify-between items-center"
							>
								<div className="flex items-center gap-3">
									<span className="text-xl font-bold text-gray-400">
										#{idx + 1}
									</span>
									<span className="font-semibold text-gray-800">{p.name}</span>
								</div>
								<span className="text-lg font-bold text-purple-600">
									{p.score}
								</span>
							</div>
						))}
					</div>

					<div className="bg-white rounded-lg p-4 shadow-md border-2 border-orange-400 text-center">
						<p className="text-sm text-gray-600 mb-2">Time Remaining</p>
						<p className="text-4xl font-bold text-orange-500">{timer}s</p>
					</div>
				</div>

				{/* Main area */}
				<div className="flex-1 flex flex-col items-center justify-center px-8 pt-4">
					<div className="mb-4 text-center">
						<h1 className="text-3xl font-bold text-gray-800 mb-4">
							Round {round}
						</h1>
						<div className="bg-yellow-100 rounded-lg px-8 py-4 inline-block border-2 border-yellow-400">
							<p className="text-3xl font-bold text-yellow-700">{word}</p>
						</div>
					</div>

					<HandCanvas
						ref={handCanvasRef}
						powerup={roundPowerup}
						onPowerupCollect={() => {
							socket.emit("collectPowerup", { lobbyName: me.lobbyName });
							setRoundPowerup(null);
						}}
					/>

					<p className="text-gray-600 mt-4 text-lg">
						✋ Draw your word using hand gestures!
					</p>
				</div>
			</div>
		);
	}

	// Waiting screen
	if (phase === "waitingForGuessing") {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
				<div className="bg-white rounded-2xl shadow-lg p-12 border-2 border-gray-200 max-w-md text-center">
					<h1 className="text-3xl font-bold text-gray-800 mb-4">Time's up!</h1>
					<p className="text-gray-600 text-lg mb-6">
						Waiting for other players...
					</p>

					<div className="flex justify-center gap-2">
						<div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce"></div>
						<div
							className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
							style={{ animationDelay: "0.1s" }}
						></div>
						<div
							className="w-3 h-3 bg-pink-500 rounded-full animate-bounce"
							style={{ animationDelay: "0.2s" }}
						></div>
					</div>
				</div>
			</div>
		);
	}

	// Guessing screen
	if (phase === "guessing") {
		return (
			<div className="min-h-screen bg-white flex flex-col items-center justify-center px-8 pt-2">
				<div className="w-full max-w-7xl">
					{/* Header */}
					<div className="text-center mb-4">
						<h1 className="text-4xl font-bold text-gray-800 mb-2">
							Guess the Drawing!
						</h1>

						<div className="flex justify-center items-center gap-6">
							{currentDrawer !== socket.id && (
								<div className="bg-blue-100 rounded-lg px-8 py-3 border-2 border-blue-400">
									<p className="text-xl font-bold text-gray-700">
										Word: {Array(wordLength).fill("_").join(" ")}
									</p>
								</div>
							)}

							<div className="bg-orange-100 rounded-lg px-8 py-3 border-2 border-orange-400">
								<p className="text-2xl font-bold text-orange-600">
									{guessTimer}s
								</p>
							</div>
						</div>
					</div>

					{/* Main content */}
					<div className="flex gap-6">
						{/* Drawing */}
						<div className="flex-1 bg-white rounded-2xl shadow-2xl p-6 border-2 border-gray-200">
							<div
								className="bg-gray-50 rounded-lg flex items-center justify-center"
								style={{ height: "500px" }}
							>
								{currentImage ? (
									<img
										src={currentImage}
										alt="Drawing to guess"
										className="max-h-full max-w-full rounded-lg shadow-lg"
										style={{ transform: "scaleX(-1)" }}
									/>
								) : (
									<p className="text-gray-400 text-lg">Loading drawing...</p>
								)}
							</div>
						</div>
						<div className="w-96 bg-white rounded-2xl shadow-2xl p-6 border-2 border-gray-200 flex flex-col">
							<h2 className="text-2xl font-bold text-gray-800 mb-4">Chat</h2>

							{socket.id === currentDrawer ? (
								<div className="bg-purple-100 rounded-lg px-4 py-3 mb-4 border-2 border-purple-400 text-center">
									<p className="text-gray-700 font-semibold">
										You're the drawer!
									</p>
								</div>
							) : (
								<div className="bg-blue-100 rounded-lg px-4 py-3 mb-4 border-2 border-blue-400 text-center">
									<p className="text-gray-700 font-semibold">
										You're the guesser!
									</p>
								</div>
							)}
							<div
								className="h-80 overflow-y-auto border-2 border-gray-200 rounded-lg p-4 bg-gray-50 mb-4"
								ref={messagesEndRef}
							>
								{chatMessages.map((m, i) => (
									<div key={i} className="mb-3">
										<span
											className={
												m.from === "System"
													? "font-bold text-green-600"
													: m.from === "You"
													? "font-bold text-blue-600"
													: "font-bold text-purple-600"
											}
										>
											{m.from}:
										</span>{" "}
										<span className="text-gray-700">{m.text}</span>
									</div>
								))}
							</div>

							{/* Input */}
							<form
								onSubmit={(e) => {
									e.preventDefault();
									if (chatInput.trim() && socket.id !== currentDrawer) {
										socket.emit("submitGuess", {
											lobbyName: me.lobbyName,
											guess: chatInput,
										});
										setChatInput("");
									}
								}}
								className="flex gap-3"
							>
								<input
									className="flex-1 bg-white border-2 border-gray-300 rounded-lg px-4 py-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 disabled:bg-gray-100"
									value={chatInput}
									onChange={(e) => setChatInput(e.target.value)}
									placeholder={
										socket.id === currentDrawer
											? "Waiting for guesses..."
											: "Type your guess..."
									}
									disabled={socket.id === currentDrawer}
								/>
								<button
									type="submit"
									className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg font-bold transform hover:scale-105 transition duration-200 disabled:opacity-50 disabled:transform-none"
									disabled={socket.id === currentDrawer}
								>
									Send
								</button>
							</form>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Round summary
	if (phase === "roundSummary") {
		return (
			<div className="min-h-screen bg-orange-50 flex items-center justify-center p-8">
				<div className="bg-white rounded-2xl shadow-2xl p-12 border-2 border-gray-200 max-w-lg w-full">
					<h1 className="text-4xl font-bold text-gray-800 mb-4 text-center">
						Round {round} Complete!
					</h1>

					<div className="bg-orange-100 rounded-lg px-6 py-4 mb-8 text-center border-2 border-orange-400">
						<p className="text-gray-700 font-semibold text-lg">
							Next round in{" "}
							<span className="text-3xl font-bold text-orange-600">
								{timer}s
							</span>
						</p>
					</div>

					<h3 className="text-xl font-bold text-gray-700 mb-4 text-center">
						Current Standings
					</h3>

					<div className="space-y-3">
						{leaderboard.map((p, idx) => (
							<div
								key={p.name}
								className={`rounded-lg px-6 py-4 shadow-md border-2 flex justify-between items-center ${
									idx === 0
										? "bg-yellow-100 border-yellow-400"
										: "bg-white border-gray-200"
								}`}
							>
								<div className="flex items-center gap-3">
									<span className="text-2xl font-bold text-gray-400">
										#{idx + 1}
									</span>
									<span className="font-bold text-gray-800">{p.name}</span>
								</div>
								<span className="text-xl font-bold text-purple-600">
									{p.score} pts
								</span>
							</div>
						))}
					</div>
				</div>
			</div>
		);
	}

	// Game over
	if (phase === "gameOver") {
		return (
			<div className="min-h-screen bg-purple-50 flex items-center justify-center p-8">
				<div className="bg-white rounded-2xl shadow-2xl p-12 border-2 border-gray-200 max-w-2xl w-full">
					<div className="text-center mb-10">
						<div className="text-7xl mb-6">🏆</div>
						<h1 className="text-5xl font-bold text-gray-800 mb-3">
							Game Over!
						</h1>
						<p className="text-xl text-gray-600">Final Results</p>
					</div>

					<div className="space-y-4 mb-10">
						{leaderboard.map((p, idx) => (
							<div
								key={p.name}
								className={`rounded-lg px-6 py-5 shadow-lg border-2 flex justify-between items-center transform transition hover:scale-105 ${
									idx === 0
										? "bg-yellow-200 border-yellow-400"
										: idx === 1
										? "bg-gray-200 border-gray-400"
										: idx === 2
										? "bg-orange-200 border-orange-400"
										: "bg-white border-gray-200"
								}`}
							>
								<div className="flex items-center gap-4">
									<span className="text-4xl">
										{idx === 0
											? "🥇"
											: idx === 1
											? "🥈"
											: idx === 2
											? "🥉"
											: `#${idx + 1}`}
									</span>
									<span className="text-xl font-bold text-gray-800">
										{p.name}
									</span>
								</div>
								<span className="text-2xl font-bold text-purple-600">
									{p.score} pts
								</span>
							</div>
						))}
					</div>

					<div className="flex gap-4">
						<button
							onClick={() => {
								socket.emit("getLobbyState", { lobbyName: me.lobbyName });
								navigate("/lobby");
							}}
							className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-6 py-4 rounded-lg font-bold transform hover:scale-105 transition duration-200 shadow-lg"
						>
							Back to Lobby
						</button>

						<button
							onClick={() => {
								socket.emit("leaveLobby", { lobbyName: me.lobbyName });
								onLeave();
							}}
							className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-4 rounded-lg font-bold transform hover:scale-105 transition duration-200 shadow-lg"
						>
							Leave Lobby
						</button>
					</div>
				</div>
			</div>
		);
	}

	return null;
};

export default Game;
