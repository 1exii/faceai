let stream;
let isDebugMode = false;

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const status = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

// Initialize the webcam
async function startWebcam() {
    try {
        const userMedia = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 }
        });
        video.srcObject = userMedia;
        stream = userMedia;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        status.innerHTML = 'Webcam active!';
    } catch (error) {
        console.error('Error accessing webcam:', error);
        status.innerHTML = `Error: ${error.message}`;
    }
}

// Stop the webcam
function stopWebcam() {
    const tracks = stream.getTracks();
    tracks.forEach(track => track.stop());
    video.srcObject = null;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    status.innerHTML = 'Webcam stopped!';
}

// Load required models
async function loadModels() {
    try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        await faceapi.nets.faceExpressionNet.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.ageGenderNet.loadFromUri('/models');
        console.log("Models loaded successfully!");
    } catch (err) {
        console.error("Error loading models:", err);
        throw err;
    }
}

// Check for signs of intoxication
function checkIntoxication(detection, landmarks) {
    const expressions = detection.expressions;
    const eyeAspectRatio = getEyeAspectRatio(landmarks);
    
    // Potential signs of intoxication
    const signs = [];
    
    if (eyeAspectRatio < 0.2) signs.push("Droopy eyes");
    if (expressions.happy > 0.7) signs.push("Excessive happiness");
    if (expressions.neutral < 0.3) signs.push("Lack of focus");
    
    return {
        isIntoxicated: signs.length >= 2,
        signs: signs
    };
}

// Calculate eye aspect ratio for droopy eye detection
function getEyeAspectRatio(landmarks) {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    
    function getEyeRatio(eye) {
        const height = (
            faceapi.euclideanDistance(eye[1], eye[5]) + 
            faceapi.euclideanDistance(eye[2], eye[4])
        ) / 2;
        const width = faceapi.euclideanDistance(eye[0], eye[3]);
        return height / width;
    }
    
    return (getEyeRatio(leftEye) + getEyeRatio(rightEye)) / 2;
}

// Main detection loop
async function detectFeatures() {
    try {
        const detections = await faceapi.detectAllFaces(video, new faceapi.SsdMobilenetv1Options())
            .withFaceLandmarks()
            .withFaceExpressions()
            .withAgeAndGender();

        ctx.clearRect(0, 0, overlay.width, overlay.height);

        if (detections.length > 0) {
            const detection = detections[0];
            const expressions = detection.expressions;
            const landmarks = detection.landmarks;
            
            // Get dominant expression
            const dominantExpression = Object.entries(expressions)
                .reduce((a, b) => a[1] > b[1] ? a : b)[0];
            
            // Check for intoxication
            const intoxicationCheck = checkIntoxication(detection, landmarks);
            
            // Build status message
            const statusMessages = [
                `Age: ~${Math.round(detection.age)}`,
                `Gender: ${detection.gender}`,
                `Expression: ${dominantExpression.charAt(0).toUpperCase() + dominantExpression.slice(1)}`,
                `Sobriety Check: ${intoxicationCheck.isIntoxicated ? '🚨 Possible intoxication' : '✅ Looking sober'}`
            ];

            if (intoxicationCheck.isIntoxicated) {
                statusMessages.push(`Signs: ${intoxicationCheck.signs.join(', ')}`);
            }
            
            status.innerHTML = statusMessages.join('<br>');

            // Draw debug view if enabled
            if (isDebugMode) {
                faceapi.draw.drawFaceLandmarks(overlay, detection);
                faceapi.draw.drawDetections(overlay, detection);
            }
        } else {
            status.innerHTML = "No face detected";
        }
    } catch (error) {
        console.error('Error in detection:', error);
    }

    requestAnimationFrame(detectFeatures);
}

// Event listeners
startBtn.addEventListener('click', startWebcam);
stopBtn.addEventListener('click', stopWebcam);

// Initialize when video starts playing
video.addEventListener('play', async () => {
    await loadModels();
    detectFeatures();
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadModels();
        console.log('FaceAPI loaded and models ready!');
    } catch (error) {
        console.error('Error initializing FaceAPI:', error);
        status.innerHTML = 'Error loading FaceAPI';
    }
});
