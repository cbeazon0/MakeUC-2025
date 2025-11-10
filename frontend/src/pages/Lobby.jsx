import { useEffect, useState } from "react";
import { socket } from "../socket/socket.js";
import { useNavigate } from "react-router-dom";
import Logo from "../assets/logo.png";

const Lobby = ({ me, onLeave }) => {
	const [players, setPlayers] = useState([]);
	const [message, setMessage] = useState("");
	const [isHost, setIsHost] = useState(false);

	const navigate = useNavigate();

	// When backend broadcasts lobby info
	useEffect(() => {
		const onLobbyUpdate = (payload) => setPlayers(payload.players || []);
		const onFull = () => setMessage("Lobby is full! (Max 6 players)");
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
		<div className="min-h-screen flex flex-col items-center justify-center bg-white pt-8 px-4">
			{/* Logo at the top */}
			<div className="w-full max-w-lg text-center mb-8 -mt-20">
				<img
					src={Logo}
					alt="Drawn to Chaos"
					className="w-80 h-auto mx-auto mb-4"
					onError={(e) => {
						console.error("Logo failed to load");
						e.target.style.display = "none";
					}}
				/>
			</div>

			{/* Lobby Card */}
			<div className="w-full max-w-md -mt-20">
				<div className="bg-white rounded-2xl shadow-lg px-8 py-8 border-2 border-gray-200">
					<div className="text-center mb-6">
						<h2 className="text-3xl font-bold text-gray-800 mb-2">
							{me.lobbyName}
						</h2>
						{players.length < 6 ? (
							<p className="text-gray-500 text-sm animate-pulse">
								Waiting for players...
							</p>
						) : (
							<p className="text-gray-500 text-sm animate-pulse">
								Waiting for host to start game...
							</p>
						)}
						{message && (
							<p className="text-orange-500 text-sm mt-2 font-semibold">
								{message}
							</p>
						)}
					</div>

					<hr className="border-t-2 border-gray-200 mb-6" />

					{/* Players List */}
					<div className="mb-6">
						<div className="flex items-center justify-between mb-3">
							<h3 className="font-bold text-gray-700 text-lg">Players</h3>
							<span className="text-sm font-semibold text-gray-500">
								{players.length}/6
							</span>
						</div>
						<div className="space-y-3">
							{players.map((p, index) => (
								<div
									key={p.sid}
									className="bg-purple-100 rounded-lg px-4 py-3 flex items-center justify-between"
								>
									<span className="font-semibold text-gray-800">{p.name}</span>
									{index === 0 && (
										<span className="text-xs font-bold text-purple-700 bg-purple-200 px-2 py-1 rounded">
											HOST
										</span>
									)}
								</div>
							))}
							{players.length < 6 && (
								<div className="bg-gray-100 rounded-lg px-4 py-3 border-2 border-dashed border-gray-300 text-center text-gray-400">
									Waiting for player...
								</div>
							)}
						</div>
					</div>

					{/* Action Buttons */}
					<div className="space-y-3">
						{isHost && (
							<button
								onClick={() =>
									socket.emit("startGame", { lobbyName: me.lobbyName })
								}
								className="w-full bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transform hover:scale-105 transition duration-200"
							>
								Start Game
							</button>
						)}
						<button
							onClick={leaveLobby}
							className="w-full bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transform hover:scale-105 transition duration-200"
						>
							Leave Lobby
						</button>
					</div>

					{!isHost && (
						<p className="text-center text-gray-500 text-sm mt-4">
							Waiting for host to start the game...
						</p>
					)}
				</div>
			</div>
		</div>
	);
};

export default Lobby;
