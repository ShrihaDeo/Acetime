
var peer = new Peer();
peer.on("open", function (id) {
    console.log("My peer ID is: " + id);
});

const constraints = {
    video: true,
    audio: true
};

navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        console.log('Got MediaStream:', stream);

        // show your camera
        const videoElement = document.querySelector('video#localVideo');
        videoElement.srcObject = stream;

        
        peer.on("call", function (call) {
            call.answer(stream);   

            call.on("stream", function (remoteStream) {
                const otherVideo = document.querySelector('video#otherVideo');
                remoteVideo.srcObject = remoteStream;
            });
        });


    })
    .catch(error => {
        console.error('Error accessing media devices.', error);
    });

    

