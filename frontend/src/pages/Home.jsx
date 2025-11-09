import { useState, useEffect } from "react";
import { socket } from "../socket/socket.js";
import Logo from "../assets/logo.png";

const Home = ({ onJoined }) => {
	const [name, setName] = useState("");
	const [lobbyName, setLobbyName] = useState("");

	useEffect(() => {
		const onError = (e) => alert(e.message || "Join/Create failed");
		const onFull = () => alert("Lobby is full! (Max 2 players)");
		const onUpdate = (payload) => {
			onJoined({ name, lobbyName });
		};

		// Listen for socket events
		socket.on("joinError", onError);
		socket.on("lobbyFull", onFull);
		socket.on("lobbyUpdate", onUpdate);

		// Cleanup
		return () => {
			socket.off("joinError", onError);
			socket.off("lobbyFull", onFull);
			socket.off("lobbyUpdate", onUpdate);
		};
	}, [name, lobbyName]);

	const joinOrCreate = (type) => {
		if (!name || !lobbyName)
			return alert("Please enter both your name and a lobby name.");
		socket.emit(type === "create" ? "createLobby" : "joinLobby", {
			name,
			lobbyName,
		});
	};

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-white pt-8 pb-4 px-4">
			{/* Logo at the top center */}
			<div className="w-full max-w-4xl text-center mb-8 -mt-45">
				<img
					src={Logo}
					alt="Drawn to Chaos"
					className="w-full max-w-2xl h-auto mx-auto"
					onError={(e) => {
						console.error("Logo failed to load");
						e.target.style.display = "none";
					}}
				/>
			</div>

			{/* Two equal components side by side */}
			<div className="w-full max-w-6xl flex flex-col lg:flex-row gap-6 items-stretch -mt-45">
				{/* Left side - Create/Join Form */}
				<div className="flex-1">
					<div className="bg-white rounded-2xl shadow-lg px-8 py-8 h-full border-2 border-gray-200">
						<div className="space-y-5">
							<p className="text-gray-800 font-bold text-xl text-center">
								Create or join a game lobby
							</p>
							<hr className="border-t-2 border-gray-200" />
							<div>
								<label className="block text-sm font-semibold text-gray-700 mb-2">
									Display Name
								</label>
								<input
									className="w-full p-3 rounded-lg bg-white text-gray-900 border-2 border-gray-300 focus:border-purple-400 focus:ring-2 focus:ring-purple-200 focus:outline-none transition placeholder-gray-400"
									placeholder="Enter your name"
									value={name}
									onChange={(e) => setName(e.target.value)}
								/>
							</div>

							<div>
								<label className="block text-sm font-semibold text-gray-700 mb-2">
									Lobby Name
								</label>
								<input
									className="w-full p-3 rounded-lg bg-white text-gray-900 border-2 border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 focus:outline-none transition placeholder-gray-400"
									placeholder="Enter lobby name"
									value={lobbyName}
									onChange={(e) => setLobbyName(e.target.value)}
								/>
							</div>
						</div>

						<div className="flex gap-4 pt-5">
							<button
								onClick={() => joinOrCreate("create")}
								className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transform hover:scale-105 transition duration-200"
							>
								Create
							</button>
							<button
								onClick={() => joinOrCreate("join")}
								className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transform hover:scale-105 transition duration-200"
							>
								Join
							</button>
						</div>

						<div className="text-center mt-4 text-gray-500 text-sm">
							<p>Max 6 players per lobby!</p>
						</div>
					</div>
				</div>

				{/* Right side - How to Play Video */}
				<div className="flex-1">
					<div className="bg-white rounded-2xl shadow-lg p-8 h-full border-2 border-gray-200">
						<h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
							How to Play
						</h2>
						<div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
							<video
								className="w-full h-full object-cover"
								controls
								poster="/path-to-thumbnail.jpg"
							>
								<source src="/path-to-video.mp4" type="video/mp4" />
								Your browser does not support the video tag.
							</video>
						</div>
						<div className="mt-4 text-gray-600 text-sm">
							<p className="text-center">
								Watch this quick tutorial to learn the basics of Drawn to Chaos!
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Home;
