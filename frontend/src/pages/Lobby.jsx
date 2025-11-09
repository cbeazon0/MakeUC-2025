import { useEffect, useEffectEvent, useState } from "react";
import { socket } from "../socket/socket.js";
import { useNavigate } from "react-router-dom";

const Lobby = ({ me, onLeave }) => {
	const [players, setPlayers] = useState([]);
	const [message, setMessage] = useState("");
	const [isHost, setIsHost] = useState(false);

	const navigate = useNavigate();

	// When backend broadcasts lobby info
	useEffect(() => {
		const onLobbyUpdate = (payload) => setPlayers(payload.players || []);
		const onFull = () => setMessage("Lobby is full! (Max 2 players)");
		const onError = (e) => setMessage(e?.message || "Join error");

		// Do things when socket events happen
		socket.on("lobbyUpdate", onLobbyUpdate);
		socket.on("lobbyFull", onFull);
		socket.on("joinError", onError);

		// Ask for current stae of lobby when entering page
		socket.emit("getLobbyState", { lobbyName: me.lobbyName });

		// Cleanup on unmount
		return () => {
			socket.off("lobbyUpdate", onLobbyUpdate);
			socket.off("lobbyFull", onFull);
			socket.off("joinError", onError);
		};
	}, [me.lobbyName]);

	useEffect(() => {
		const onGameStart = () => {
			navigate("/game");
		};

		const onGameInit = () => {
			navigate("/game");
		};

		const onRoundBegin = () => {
			navigate("/game");
		};

		// Listen for game start events
		socket.on("gameStarted", onGameStart);
		socket.on("gameInit", onGameInit);
		socket.on("roundBegin", onRoundBegin);

		// Cleanup
		return () => {
			socket.off("gameStarted", onGameStart);
			socket.off("gameInit", onGameInit);
			socket.off("roundBegin", onRoundBegin);
		};
	}, []);

	useEffect(() => {
		// Determine if current player is host
		setIsHost(players.length > 0 && players[0].name === me.name);
	}, [players, me.name]);

	const leaveLobby = () => {
		socket.emit("leaveLobby", { lobbyName: me.lobbyName });
		onLeave(); // go back to home page
	};

	return (
		<div className="min-h-screen bg-gray-900 text-white flex flex-col items-center pt-10">
			<h2 className="text-2xl font-semibold mb-2">Lobby: {me.lobbyName}</h2>
			<p className="text-sm text-gray-300 mb-4">{message}</p>

			<div className="bg-gray-800 rounded p-4 w-64">
				<h3 className="font-semibold mb-2">Players ({players.length}/2)</h3>
				<ul className="space-y-2">
					{players.map((p) => (
						<li key={p.sid} className="bg-gray-700 rounded px-3 py-1">
							{p.name}
						</li>
					))}
				</ul>
			</div>

			<button
				onClick={leaveLobby}
				className="mt-6 bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
			>
				Leave Lobby
			</button>

			{isHost && (
				<button
					onClick={() => socket.emit("startGame", { lobbyName: me.lobbyName })}
					className="mt-4 bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
				>
					Start Game
				</button>
			)}
		</div>
	);
};

export default Lobby;
