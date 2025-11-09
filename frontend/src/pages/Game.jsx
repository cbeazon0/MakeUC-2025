import { useEffect, useState, useRef } from "react";
import { socket } from "../socket/socket.js";
import HandCanvas from "../components/HandCanvas.jsx";

const Game = ({ me }) => {
	const [phase, setPhase] = useState("loading");
	const [word, setWord] = useState(null);
	const [round, setRound] = useState(0);
	const [countdown, setCountdown] = useState(5);
	const [timer, setTimer] = useState(null);
	const [leaderboard, setLeaderboard] = useState([]);
	const [guessTimer, setGuessTimer] = useState(0);
	const [currentImage, setCurrentImage] = useState(null);
	const [currentDrawer, setCurrentDrawer] = useState(null);

	const handCanvasRef = useRef(null);

	useEffect(() => {
		socket.on("gameInit", () => setPhase("loading"));
		socket.on("roundBegin", (data) => {
			setRound(data.round);
			setWord(data.words[socket.id]);
			setPhase("wordReveal");
			setCountdown(5);
		});

		return () => {
			socket.off("gameInit");
			socket.off("roundBegin");
		};
	}, []);

	// 5 second word reveal timer
	useEffect(() => {
		if (phase !== "wordReveal") return;

		const interval = setInterval(() => {
			setCountdown((prev) => {
				if (prev <= 1) {
					clearInterval(interval);
					setPhase("drawing");
					setTimer(60);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return () => clearInterval(interval);
	}, [phase]);

	// 60 second drawing timer
	useEffect(() => {
		if (phase !== "drawing") return;

		const interval = setInterval(() => {
			setTimer((prev) => {
				if (prev <= 1) {
					clearInterval(interval);
					const imageData = handCanvasRef.current?.getImage();
					socket.emit("submitDrawing", {
						lobbyName: me.lobbyName,
						image: imageData,
					});
					setPhase("guessing");
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return () => clearInterval(interval);
	}, [phase]);

	// Guessing phase timer
	useEffect(() => {
		if (phase !== "guessing" || guessTimer <= 0) return;
		const interval = setInterval(() => {
			setGuessTimer((t) => {
				if (t <= 1) {
					clearInterval(interval);
					return 0;
				}
				return t - 1;
			});
		}, 1000);
		return () => clearInterval(interval);
	}, [phase]);

	useEffect(() => {
		socket.on("roundEnd", (data) => {
			setPhase("roundEnd");
		});

		return () => socket.off("roundEnd");
	}, []);

	// Leaderboard stuff
	useEffect(() => {
		setLeaderboard([
			{ name: "Player 1", score: 10 },
			{ name: "Player 2", score: 5 },
		]);
	}, [phase]);

	useEffect(() => {
		socket.on("showDrawing", (data) => {
			setCurrentImage(data.image);
			setCurrentDrawer(data.drawer);
			setGuessTimer(data.duration);
			setPhase("guessing");
		});

		socket.on("roundSummary", (data) => {
			setPhase("roundSummary");
		});

		return () => {
			socket.off("showDrawing");
			socket.off("roundSummary");
		};
	}, []);

	if (phase === "loading") {
		return (
			<div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
				<h1 className="text-3xl font-bold animate-pulse">Loading game...</h1>
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
				<p className="text-gray-400 mt-3">Starting in {countdown}...</p>
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

	if (phase === "finishedDrawing") {
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
				<h1 className="text-2xl font-bold mb-2">
					Guess the drawing! (by {currentDrawer})
				</h1>
				<p className="text-gray-400 mb-4">Time left: {guessTimer}s</p>

				<div className="bg-gray-800 rounded-lg w-3/4 h-[480px] flex items-center justify-center">
					<img
						src={currentImage}
						alt="Drawing to guess"
						className="max-h-[460px] rounded shadow-lg"
					/>
				</div>

				<p className="mt-6 text-gray-400 italic">
					(Guessing input will go here later)
				</p>
			</div>
		);
	}

	if (phase === "roundSummary") {
		return (
			<div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
				<h1 className="text-2xl font-bold mb-2">All drawings shown!</h1>
				<p className="text-gray-400">Next round coming soon...</p>
			</div>
		);
	}

	return null;
};

export default Game;
