const constraints = {
    video: true,
    audio: true
};

navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        console.log('Got MediaStream:', stream);

        const videoElement = document.querySelector('video#localVideo');
        videoElement.srcObject = stream;
    })
    .catch(error => {
        console.error('Error accessing media devices.', error);
    });
