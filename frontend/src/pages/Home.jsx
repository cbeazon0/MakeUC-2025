import { useState, useEffect } from "react";
import { socket } from "../socket/socket.js";

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
		<div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white gap-3">
			<h1 className="text-3xl font-bold mb-4">Tiny Lobby Demo</h1>

			<input
				className="p-2 rounded text-white"
				placeholder="Your display name"
				value={name}
				onChange={(e) => setName(e.target.value)}
			/>

			<input
				className="p-2 rounded text-white"
				placeholder="Lobby name"
				value={lobbyName}
				onChange={(e) => setLobbyName(e.target.value)}
			/>

			<div className="flex gap-3 mt-3">
				<button
					onClick={() => joinOrCreate("create")}
					className="bg-green-600 px-4 py-2 rounded hover:scale-105 hover:bg-green-700 transition duration-200"
				>
					Create
				</button>
				<button
					onClick={() => joinOrCreate("join")}
					className="bg-blue-600 px-4 py-2 rounded hover:scale-105 hover:bg-blue-700 transition duration-200"
				>
					Join
				</button>
			</div>
		</div>
	);
};

export default Home;
