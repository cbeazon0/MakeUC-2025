import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import {
	HandLandmarker,
	FilesetResolver,
	DrawingUtils,
} from "@mediapipe/tasks-vision";

// Linear interpolation function to help smooth finger movements
function lerp(a, b, t) {
	return a + (b - a) * t;
}

const HandCanvas = () => {
	// Webcam ref
	const webcamRef = useRef(null);

	// Canvas refs
	const bgRef = useRef(null);
	const drawRef = useRef(null);
	const overlayRef = useRef(null);

	// Toggle background button area
	const toggleArea = useRef({ x: 20, y: 400, w: 100, h: 60 });

	// Mediapipe hand landmarker
	const [handLandmarker, setHandLandmarker] = useState(null);

	// Show bg and drawing color state
	const [showBg, setShowBg] = useState(false);
	const [drawColor, setDrawColor] = useState("#f43f5e");

	// Ref to keep track of current draw color
	const drawColorRef = useRef(drawColor);

	// Update drawColorRef whenever drawColor changes
	useEffect(() => {
		drawColorRef.current = drawColor;
	}, [drawColor]);

	const drawColors = ["#f43f5e", "#3b82f6", "#22c55e", "#facc15", "#000000"];

	// previous and smoothed positions and hover state for when user hovers button
	const prevPos = useRef({ x: null, y: null });
	const smoothPos = useRef({ x: 0, y: 0 });
	const hoverState = useRef({ button: null, start: null });

	// Mediapipe initialization
	useEffect(() => {
		const setup = async () => {
			const vision = await FilesetResolver.forVisionTasks(
				"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
			);
			const landmarker = await HandLandmarker.createFromOptions(vision, {
				baseOptions: {
					modelAssetPath:
						"https://storage.googleapis.com/mediapipe-assets/hand_landmarker.task",
				},
				numHands: 1,
				runningMode: "VIDEO",
			});
			setHandLandmarker(landmarker);
		};
		setup();
	}, []);

	// Draw background based on showBg state
	useEffect(() => {
		const ctx = bgRef.current.getContext("2d");
		ctx.clearRect(0, 0, 640, 480);
		ctx.fillStyle = showBg ? "white" : "transparent";
		ctx.fillRect(0, 0, 640, 480);
	}, [showBg]);

	// Main processing loop
	useEffect(() => {
		if (!handLandmarker) return; // Wait for hand tracking model

		// Get video and canvas contexts
		const video = webcamRef.current.video;
		const drawCtx = drawRef.current.getContext("2d");
		const overlayCtx = overlayRef.current.getContext("2d");
		const utils = new DrawingUtils(overlayCtx);

		// Frame processing
		let frameCount = 0;
		let rafId = null;
		let running = true;

		const processFrame = async () => {
			if (!running) return;
			frameCount++;

			// Ensure video is ready
			if (video.readyState === 4 && video.videoWidth > 0) {
				// Process every other frame for performance
				if (frameCount % 2 === 0) {
					const results = await handLandmarker.detectForVideo(
						video,
						performance.now()
					);
					overlayCtx.clearRect(0, 0, 640, 480);

					// Draw color bar at top
					overlayCtx.save();
					overlayCtx.scale(-1, 1);
					overlayCtx.translate(-640, 0);
					drawColors.forEach((c, i) => {
						const x = 40 + i * 110,
							y = 20,
							w = 80,
							h = 40;
						overlayCtx.fillStyle = c;
						overlayCtx.fillRect(x, y, w, h);
						overlayCtx.lineWidth = 3;
						overlayCtx.strokeStyle =
							c === drawColorRef.current ? "#00ffff" : "#ffffff";
						overlayCtx.strokeRect(x, y, w, h);
					});

					// Draw toggle bg button
					const { x, y, w, h } = toggleArea.current;
					overlayCtx.fillStyle = "rgba(0,0,0,0.25)";
					overlayCtx.fillRect(x, y, w, h);
					overlayCtx.strokeStyle = "white";
					overlayCtx.lineWidth = 2;
					overlayCtx.strokeRect(x, y, w, h);
					overlayCtx.font = "16px sans-serif";
					overlayCtx.fillStyle = "white";
					overlayCtx.fillText("Toggle BG", x + 10, y + 35);
					overlayCtx.restore();

					// Draw hand skeleton
					if (results.landmarks?.length > 0) {
						const hand = results.landmarks[0];
						utils.drawConnectors(hand, HandLandmarker.HAND_CONNECTIONS, {
							color: "#00FFAA",
							lineWidth: 2,
						});
						utils.drawLandmarks(hand, { color: "#FF006E", radius: 3 });

						// Smooth fingertip tracking
						const indexTip = hand[8];
						const thumbTip = hand[4];

						let xPos = indexTip.x * 640;
						let yPos = indexTip.y * 480;

						smoothPos.current.x = lerp(smoothPos.current.x, xPos, 0.4);
						smoothPos.current.y = lerp(smoothPos.current.y, yPos, 0.4);
						xPos = smoothPos.current.x;
						yPos = smoothPos.current.y;

						const drawing =
							Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y) <
							0.06;

						// Drawing on canvas logic
						if (drawing) {
							if (prevPos.current.x !== null) {
								drawCtx.beginPath();
								drawCtx.moveTo(prevPos.current.x, prevPos.current.y);
								drawCtx.lineTo(xPos, yPos);
								drawCtx.strokeStyle = drawColorRef.current; // <—
								drawCtx.lineWidth = 4;
								drawCtx.lineCap = "round";
								drawCtx.stroke();
							}
							prevPos.current = { x: xPos, y: yPos };
						} else {
							prevPos.current = { x: null, y: null };
						}

						// Dot on fingertip
						overlayCtx.beginPath();
						overlayCtx.arc(xPos, yPos, 8, 0, 2 * Math.PI);
						overlayCtx.fillStyle = drawing ? drawColorRef.current : "#00ffff";
						overlayCtx.fill();

						// Hover deteciton logic
						const now = performance.now();
						let hovered = null;

						// Detect color hover
						const mirroredX = 640 - xPos;
						drawColors.forEach((c, i) => {
							const x = 40 + i * 110,
								y = 20,
								w = 80,
								h = 40;
							if (
								mirroredX >= x &&
								mirroredX <= x + w &&
								yPos >= y &&
								yPos <= y + h
							) {
								hovered = { type: "drawColor", color: c };
							}
						});
						
                        // Detect toggle bg hover
						if (
							mirroredX >= toggleArea.current.x &&
							mirroredX <= toggleArea.current.x + toggleArea.current.w &&
							yPos >= toggleArea.current.y &&
							yPos <= toggleArea.current.y + toggleArea.current.h
						) {
							hovered = { type: "toggle" };
						}

						// Hold to activate button with progress circle
						if (hovered) {
							if (
								!hoverState.current.button ||
								hoverState.current.button !== JSON.stringify(hovered)
							) {
								hoverState.current = {
									button: JSON.stringify(hovered),
									start: now,
								};
							} else {
								const progress = Math.min(
									(now - hoverState.current.start) / 1000,
									1
								);
								overlayCtx.beginPath();
								overlayCtx.arc(
									xPos,
									yPos,
									20,
									-Math.PI / 2,
									progress * 2 * Math.PI - Math.PI / 2
								);
								overlayCtx.strokeStyle = progress < 1 ? "#00ffff" : "#00ff88";
								overlayCtx.lineWidth = 4;
								overlayCtx.stroke();

                                // Activate button action when progress completes (1 sec)
								if (progress >= 1) {
                                    // Change draw color else toggle bg
									if (hovered.type === "drawColor") {
										drawCtx.beginPath();
										prevPos.current = { x: null, y: null };
										setDrawColor(hovered.color);
									} else if (hovered.type === "toggle") {
										setShowBg((p) => !p);
									}
									hoverState.current = { button: null, start: null };
								}
							}
						} else {
							hoverState.current = { button: null, start: null };
						}
					}
				}
			}
			rafId = requestAnimationFrame(processFrame);
		};

        // Start processing loop and cancel on cleanup
		rafId = requestAnimationFrame(processFrame);
		return () => {
			running = false;
			if (rafId) cancelAnimationFrame(rafId);
		};
	}, [handLandmarker]);

    // Clear drawing canvas function
	const clearDrawing = () => {
		const ctx = drawRef.current.getContext("2d");
		ctx.clearRect(0, 0, 640, 480);
		prevPos.current = { x: null, y: null };
	};

	return (
		<div className="relative flex flex-col items-center">
            {/* Webcam component */}
			<Webcam
				ref={webcamRef}
				mirrored
				className="rounded-lg shadow-md"
				style={{ width: 640, height: 480 }}
				videoConstraints={{ width: 480, height: 360, facingMode: "user" }}
			/>

            {/* Canvas for bg */}
			<canvas
				ref={bgRef}
				width={640}
				height={480}
				className="absolute top-0 left-0 rounded-lg"
				style={{ transform: "scaleX(-1)" }}
			/>

            {/* Canvas for drawing */}
			<canvas
				ref={drawRef}
				width={640}
				height={480}
				className="absolute top-0 left-0 rounded-lg"
				style={{ transform: "scaleX(-1)" }}
			/>

            {/* Canvas for overlay */}
			<canvas
				ref={overlayRef}
				width={640}
				height={480}
				className="absolute top-0 left-0 rounded-lg pointer-events-none"
				style={{ transform: "scaleX(-1)" }}
			/>

            {/* Clear canvas button at bottom of stuff */}
			<div className="mt-4">
				<button
					onClick={clearDrawing}
					className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-xl shadow"
				>
					Clear Canvas
				</button>
			</div>
		</div>
	);
};

export default HandCanvas;
