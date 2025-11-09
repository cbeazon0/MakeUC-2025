import { Routes, Route, useNavigate } from "react-router-dom";
import { useState } from "react";
import Home from "./pages/Home";
import Lobby from "./pages/Lobby";
import Game from "./pages/Game";

const App = () => {
	const [me, setMe] = useState(null);
	const navigate = useNavigate();

	return (
		<Routes>
			<Route
				path="/"
				element={
					<Home
						onJoined={(info) => {
							setMe(info);
							navigate("/lobby");
						}}
					/>
				}
			/>
			<Route
				path="/lobby"
				element={
					<Lobby
						me={me}
						onLeave={() => {
							setMe(null);
							navigate("/");
						}}
					/>
				}
			/>
			<Route
				path="/game"
				element={
					<Game
						me={me}
						onLeave={() => {
							setMe(null);
							navigate("/");
						}}
					/>
				}
			/>
		</Routes>
	);
};

export default App;
