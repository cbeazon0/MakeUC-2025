import HandCanvas from "../components/HandCanvas";

const Home = () => {
	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
			<h1 className="text-3xl font-bold mb-6 text-pink-400">Drawn to Chaos</h1>
			<HandCanvas />
			<p className="mt-6 text-gray-400">
				Pinch your index finger and thumb to draw in mid-air!
			</p>
		</div>
	);
};

export default Home;
