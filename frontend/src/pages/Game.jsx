import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket/socket.js";
import HandCanvas from "../components/HandCanvas.jsx";

const Game = ({ me, onLeave }) => {
	const [phase, setPhase] = useState("loading");
	const [word, setWord] = useState(null);
	const [round, setRound] = useState(0);
	const [timer, setTimer] = useState(0);
	const [leaderboard, setLeaderboard] = useState([]);
	const [wordLength, setWordLength] = useState(0);

	// Syncing stuff
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

	useEffect(() => {
		socket.on("showDrawing", (data) => {
			setCurrentImage(data.image);
			setCurrentDrawer(data.drawer);
			setEndTime(data.endTime);
			setWordLength(data.wordLength || 0);
			setPhase("guessing");
		});

		return () => {
			socket.off("showDrawing");
		};
	}, []);

	useEffect(() => {
		socket.on("chatMessage", (msg) =>
			setChatMessages((prev) => [...prev, msg])
		);

		return () => {
			socket.off("chatMessage");
		};
	}, []);

	useEffect(() => {
		socket.on("updatePoints", (data) => {
			if (data?.players?.length) setLeaderboard(data.players);
		});

		return () => socket.off("updatePoints");
	}, []);

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

	if (phase === "loading") {
		return (
			<div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
				<h1 className="text-3xl font-bold animate-pulse">Loading game...</h1>
			</div>
		);
	}

	if (phase === "loadingNext") {
		return (
			<div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
				<h1 className="text-2xl font-bold mb-2 animate-pulse">
					Preparing next stage...
				</h1>
				<p className="text-gray-400">
					Please wait while everyone finishes drawing.
				</p>
			</div>
		);
	}

	if (phase === "wordReveal") {
		return (
			<div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
				<h1 className="text-3xl font-bold">Round {round}</h1>
				<p className="text-xl mt-2">
					Your word: <span className="text-green-400 font-bold">{word}</span>
				</p>
				<p className="text-gray-400 mt-3">Starting in {timer}...</p>
			</div>
		);
	}

	if (phase === "drawing") {
		return (
			<div className="min-h-screen bg-gray-900 text-white flex">
				<div className="w-1/4 bg-gray-800 p-4 border-r border-gray-700">
					<h2 className="text-xl font-semibold mb-3">Leaderboard</h2>
					<ul className="space-y-2">
						{leaderboard.map((p) => (
							<li
								key={p.name}
								className="flex justify-between bg-gray-700 rounded px-3 py-1"
							>
								<span>{p.name}</span>
								<span>{p.score}</span>
							</li>
						))}
					</ul>
					<div className="mt-4 text-sm text-gray-400">Time left: {timer}s</div>
				</div>

				<div className="flex-1 flex flex-col items-center justify-center">
					<h1 className="text-2xl font-bold mb-3">
						Round {round}: {word}
					</h1>

					<div className="bg-gray-700 rounded-lg w-3/4 h-[480px] flex items-center justify-center">
						<HandCanvas ref={handCanvasRef} />
					</div>

					<p className="text-gray-400 mt-3">
						Draw your word using your hand gestures!
					</p>
				</div>
			</div>
		);
	}

	if (phase === "waitingForGuessing") {
		return (
			<div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
				<h1 className="text-2xl font-bold">Time’s up!</h1>
				<p className="text-gray-400 mt-2">Waiting for other players...</p>
			</div>
		);
	}

	if (phase === "guessing") {
		return (
			<div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
				{currentDrawer !== socket.id && (
					<p className="text-xl mb-3 text-gray-300">
						Word: {Array(wordLength).fill("_").join(" ")}
					</p>
				)}
				<p className="text-gray-400 mb-4">Time left: {guessTimer}s</p>

				<div className="bg-gray-800 rounded-lg w-3/4 h-[480px] flex items-center justify-center">
					{currentImage ? (
						<img
							src={currentImage}
							alt="Drawing to guess"
							className="max-h-[460px] rounded shadow-lg"
						/>
					) : (
						<p className="text-gray-400">Waiting for drawing...</p>
					)}
				</div>

				{socket.id === currentDrawer && (
					<div className="text-sm text-gray-400 mb-2 italic">
						You are the drawer — waiting for guesses...
					</div>
				)}

				{/* Chat UI */}
				<div className="mt-6 w-3/4 bg-gray-800 rounded-lg p-4">
					<div className="h-48 overflow-y-auto border-b border-gray-700 mb-3">
						{chatMessages.map((m, i) => (
							<div key={i} className="text-sm">
								<span
									className={
										m.from === "System"
											? "font-semibold text-green-400"
											: "font-semibold text-blue-400"
									}
								>
									{m.from}:
								</span>{" "}
								<span>{m.text}</span>
							</div>
						))}
					</div>
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
						className="flex space-x-2"
					>
						<input
							className="flex-1 bg-gray-700 rounded px-3 py-1 outline-none disabled:opacity-50"
							value={chatInput}
							onChange={(e) => setChatInput(e.target.value)}
							placeholder={
								socket.id === currentDrawer
									? "You’re the drawer. Waiting for guesses..."
									: "Type your guess..."
							}
							disabled={socket.id === currentDrawer}
						/>
						<button
							type="submit"
							className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded disabled:opacity-50"
							disabled={socket.id === currentDrawer}
						>
							Send
						</button>
					</form>
				</div>
			</div>
		);
	}

	if (phase === "roundSummary") {
		return (
			<div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
				<h1 className="text-3xl font-bold mb-2">Round {round} Summary</h1>
				<h2 className="text-gray-400 mb-4">
					Next round starting in {timer}s...
				</h2>
				<div className="bg-gray-800 rounded p-4 w-64">
					<h3 className="font-semibold mb-2">Leaderboard</h3>
					<ul className="space-y-2">
						{leaderboard.map((p) => (
							<li
								key={p.name}
								className="flex justify-between bg-gray-700 rounded px-3 py-1"
							>
								<span>{p.name}</span>
								<span>{p.score}</span>
							</li>
						))}
					</ul>
				</div>
			</div>
		);
	}

	if (phase === "gameOver") {
		return (
			<div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
				<h1 className="text-3xl font-bold mb-2">Game Over!</h1>
				<h2 className="text-gray-400 mb-4">Final Leaderboard</h2>

				<div className="bg-gray-800 rounded p-4 w-64 mb-6">
					<ul className="space-y-2">
						{leaderboard.map((p) => (
							<li
								key={p.name}
								className="flex justify-between bg-gray-700 rounded px-3 py-1"
							>
								<span>{p.name}</span>
								<span>{p.score}</span>
							</li>
						))}
					</ul>
				</div>

				<div className="flex space-x-4">
					{/* Back to Lobby */}
					<button
						onClick={() => {
							socket.emit("getLobbyState", { lobbyName: me.lobbyName });
							navigate("/lobby");
						}}
						className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
					>
						Back to Lobby
					</button>

					{/* Leave Lobby */}
					<button
						onClick={() => {
							socket.emit("leaveLobby", { lobbyName: me.lobbyName });
							onLeave();
						}}
						className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
					>
						Leave Lobby
					</button>
				</div>
			</div>
		);
	}

	return null;
};

export default Game;
