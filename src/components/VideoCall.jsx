// Front/src/components/VideoCall.js
import React, { useState, useRef, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faVideo,
  faVideoSlash,
  faMicrophone,
  faMicrophoneSlash,
  faExpand,
  faCompress,
  faArrowsAlt,
  faPlus,
  faMinus,
  faPhone,
  faPhoneSlash,
  faVolumeUp,
  faVolumeMute,
} from "@fortawesome/free-solid-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";
import { Rnd } from "react-rnd";
import Swal from "sweetalert2";

library.add(
  faVideo,
  faVideoSlash,
  faMicrophone,
  faMicrophoneSlash,
  faExpand,
  faCompress,
  faArrowsAlt,
  faPlus,
  faMinus,
  faPhone,
  faPhoneSlash,
  faVolumeUp,
  faVolumeMute
);

const initialWidth = 320;
const initialHeight = 480;

function VideoCall({
  socket,
  isHidden,
  onToggle,
  showVideoCall,
  isFullScreen,
  isAudioCallEnabled,
  targetUserId,
  startWithAudio,
  startWithVideo,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);

  const [isAudioEnabled, setIsAudioEnabled] = useState(startWithAudio);
  const [isVideoEnabled, setIsVideoEnabled] = useState(startWithVideo);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: initialWidth,
    height: initialHeight,
  });
  const [isCallActive, setIsCallActive] = useState(false);
  const [isRemoteAudioMuted, setIsRemoteAudioMuted] = useState(false);

  const [micVolume, setMicVolume] = useState(100);
  const [remoteVolume, setRemoteVolume] = useState(100);

  const audioContextRef = useRef(null);
  const gainNodeRef = useRef(null);

  const configuration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      // Ek ICE sunucuları eklenebilir
    ],
  };

  const toggleAudio = useCallback(() => {
    setIsAudioEnabled((prev) => !prev);
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      localVideoRef.current.srcObject
        .getAudioTracks()
        .forEach((track) => (track.enabled = !track.enabled));
    }
  }, []);

  const toggleVideo = useCallback(() => {
    setIsVideoEnabled((prev) => !prev);
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      localVideoRef.current.srcObject
        .getVideoTracks()
        .forEach((track) => (track.enabled = !track.enabled));
    }
  }, []);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
    setDimensions((prevState) => ({
      width: prevState.width === "100%" ? initialWidth : "100%",
      height: prevState.height === "100%" ? initialHeight : "100%",
    }));
  }, []);

  const handleResize = useCallback((e, direction, ref, delta, position) => {
    setDimensions({
      width: ref.offsetWidth,
      height: ref.offsetHeight,
    });
  }, []);

  const increaseSize = useCallback(() => {
    setDimensions((prev) => ({
      width: prev.width + 50,
      height: prev.height + 50,
    }));
  }, []);

  const decreaseSize = useCallback(() => {
    setDimensions((prev) => ({
      width: Math.max(150, prev.width - 50),
      height: Math.max(150, prev.height - 50),
    }));
  }, []);

  const toggleRemoteMute = useCallback(() => {
    setIsRemoteAudioMuted((prev) => !prev);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !isRemoteAudioMuted;
    }
  }, [isRemoteAudioMuted]);

  const handleMicVolumeChange = useCallback((e) => {
    const value = parseInt(e.target.value, 10);
    setMicVolume(value);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = value / 100;
    }
  }, []);

  const handleRemoteVolumeChange = useCallback((e) => {
    const value = parseInt(e.target.value, 10);
    setRemoteVolume(value);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = value / 100;
    }
  }, []);

  const startCall = useCallback(async () => {
    if (!targetUserId) {
      Swal.fire("Uyarı!", "Bağlanacak başka bir kullanıcı yok.", "warning");
      return;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    try {
      const mediaConstraints = {
        video: isVideoEnabled
          ? {
              width: { min: 640, ideal: 1920 },
              height: { min: 480, ideal: 1080 },
            }
          : false,
        audio: isAudioEnabled,
      };
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      } catch (error) {
        console.warn("Kamera veya mikrofon erişim hatası:", error);
        Swal.fire({
          icon: "warning",
          title: "Kamera/Mikrofon Erişilemiyor",
          text: `Görüntülü görüşme için kamera veya mikrofona erişilemedi. Sesli görüşme başlatılıyor. Hata: ${error.message}`,
        });
        setIsVideoEnabled(false); // Kamerayı kapat ve sadece sesli devam et
        stream = await navigator.mediaDevices.getUserMedia({
          audio: isAudioEnabled,
        });
      }

      audioContextRef.current = new AudioContext();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.gain.value = micVolume / 100;

      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();

      if (audioTracks.length > 0) {
        const audioSource = audioContextRef.current.createMediaStreamSource(
          new MediaStream(audioTracks) // Use existing audio tracks
        );
        audioSource.connect(gainNodeRef.current);
      }

      const destination =
        audioContextRef.current.createMediaStreamDestination();
      gainNodeRef.current.connect(destination);

      const combinedStream = new MediaStream([
        ...destination.stream.getAudioTracks(),
        ...(isVideoEnabled ? videoTracks : []), // Only add video tracks if enabled
      ]);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = combinedStream;
      }

      const peerConnection = new RTCPeerConnection(configuration);
      peerConnectionRef.current = peerConnection;

      combinedStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, combinedStream);
      });

      peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.volume = remoteVolume / 100;
        }
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            target: targetUserId,
            candidate: event.candidate,
          });
        }
      };

      const offerOptions = {
        offerToReceiveAudio: 1,
        offerToReceiveVideo: isVideoEnabled ? 1 : 0,
      };
      const offer = await peerConnection.createOffer(offerOptions);
      await peerConnection.setLocalDescription(offer);

      socket.emit("offer", {
        target: targetUserId,
        offer: offer,
      });

      setIsCallActive(true);
    } catch (error) {
      console.error("Arama başlatılamadı:", error);
      Swal.fire(
        "Hata!",
        `Arama başlatılırken bir hata oluştu: ${error.message}`,
        "error"
      );
    }
  }, [
    socket,
    targetUserId,
    configuration,
    isVideoEnabled,
    isAudioEnabled,
    micVolume,
    remoteVolume,
  ]);

  const endCall = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      remoteVideoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop());
      remoteVideoRef.current.srcObject = null;
    }
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      localVideoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop());
      localVideoRef.current.srcObject = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    gainNodeRef.current = null;
    setIsCallActive(false);
  }, []);

  useEffect(() => {
    const handleOffer = async (data) => {
      const { from, offer } = data;
      if (!from) {
        console.error("Teklif gönderen yok.");
        return;
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      try {
        const mediaConstraints = {
          video: isVideoEnabled
            ? {
                width: { min: 640, ideal: 1920 },
                height: { min: 480, ideal: 1080 },
              }
            : false,
          audio: isAudioEnabled,
        };
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        } catch (error) {
          console.warn(
            "Gelen aramada kamera veya mikrofon erişim hatası:",
            error
          );
          Swal.fire({
            icon: "warning",
            title: "Kamera/Mikrofon Erişilemiyor",
            text: `Gelen görüntülü arama için kamera veya mikrofona erişilemedi. Sesli yanıtlanıyor. Hata: ${error.message}`,
          });
          setIsVideoEnabled(false);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: isAudioEnabled,
          });
        }

        audioContextRef.current = new AudioContext();
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.gain.value = micVolume / 100;

        const audioTracks = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();

        if (audioTracks.length > 0) {
          const audioSource = audioContextRef.current.createMediaStreamSource(
            new MediaStream(audioTracks)
          );
          audioSource.connect(gainNodeRef.current);
        }

        const destination =
          audioContextRef.current.createMediaStreamDestination();
        gainNodeRef.current.connect(destination);

        const combinedStream = new MediaStream([
          ...destination.stream.getAudioTracks(),
          ...(isVideoEnabled ? videoTracks : []),
        ]);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = combinedStream;
        }

        const peerConnection = new RTCPeerConnection(configuration);
        peerConnectionRef.current = peerConnection;

        combinedStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, combinedStream);
        });

        peerConnection.ontrack = (event) => {
          const remoteStream = event.streams[0];
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.volume = remoteVolume / 100;
          }
        };

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("ice-candidate", {
              target: from,
              candidate: event.candidate,
            });
          }
        };

        await peerConnection.setRemoteDescription(offer);

        const answerOptions = {
          offerToReceiveAudio: 1,
          offerToReceiveVideo: isVideoEnabled ? 1 : 0,
        };
        const answer = await peerConnection.createAnswer(answerOptions);
        await peerConnection.setLocalDescription(answer);

        socket.emit("answer", {
          target: from,
          answer: answer,
        });

        setIsCallActive(true);
      } catch (error) {
        console.error("Teklif işlenirken hata:", error);
        Swal.fire(
          "Hata!",
          `Teklif işlenirken bir hata oluştu: ${error.message}`,
          "error"
        );
      }
    };

    const handleAnswer = async (data) => {
      const { from, answer } = data;
      if (!from || !peerConnectionRef.current) {
        console.error("Cevap gönderen yok veya aktif bir bağlantı yok.");
        return;
      }
      try {
        await peerConnectionRef.current.setRemoteDescription(answer);
      } catch (error) {
        console.error("Cevap ayarlanırken hata:", error);
        Swal.fire(
          "Hata!",
          `Cevap ayarlanırken bir hata oluştu: ${error.message}`,
          "error"
        );
      }
    };

    const handleIceCandidate = async (data) => {
      const { from, candidate } = data;
      if (!from || !peerConnectionRef.current) {
        console.error("ICE candidate hedefi yok veya aktif bağlantı yok.");
        return;
      }
      try {
        if (peerConnectionRef.current.signalingState !== "closed") {
          await peerConnectionRef.current.addIceCandidate(candidate);
        } else {
          console.warn("ICE adayı alınırken bağlantı kapalı.", data);
        }
      } catch (error) {
        console.error("ICE adayı eklenirken hata:", error);
        Swal.fire(
          "Uyarı!",
          `ICE adayı eklenirken bir hata oluştu: ${error.message}`,
          "warning"
        );
      }
    };
    socket.on("error", (errorMessage) => {
      Swal.fire("Hata!", `Bir hata oluştu: ${errorMessage}`, "error");
    });
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIceCandidate);

    return () => {
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("error");
    };
  }, [
    socket,
    configuration,
    isVideoEnabled,
    isAudioEnabled,
    micVolume,
    remoteVolume,
  ]);

  if (isHidden) {
    return null;
  }

  return (
    <Rnd
      default={{
        x: isFullScreen
          ? window.innerWidth - initialWidth - 20
          : window.innerWidth - initialWidth - 400,
        y: isFullScreen ? 40 : 40,
        width: dimensions.width,
        height: dimensions.height,
      }}
      minWidth={150}
      minHeight={280}
      onResize={handleResize}
      className="rounded-md overflow-hidden z-[9999]"
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <div
        className="bg-gray-800 rounded-md h-full shadow-md"
        style={{ borderRadius: "1.5rem" }}
      >
        <div
          className="bg-gray-700 border-b border-gray-600 flex justify-between items-center p-2 cursor-move text-white"
          style={{
            borderTopLeftRadius: "1.5rem",
            borderTopRightRadius: "1.5rem",
          }}
        >
          <div className="flex items-center">
            <FontAwesomeIcon
              icon={faArrowsAlt}
              className="mr-2 text-gray-400"
            />
            <h3 className="text-sm font-semibold">Görüntülü Görüşme</h3>
          </div>
          <div>
            <button
              onClick={increaseSize}
              className="p-1 hover:bg-gray-600 rounded-full text-gray-300 focus:outline-none"
              style={{ borderRadius: "1.5rem" }}
            >
              <FontAwesomeIcon icon={faPlus} />
            </button>
            <button
              onClick={decreaseSize}
              className="p-1 hover:bg-gray-600 rounded-full text-gray-300 focus:outline-none"
              style={{ borderRadius: "1.5rem" }}
            >
              <FontAwesomeIcon icon={faMinus} />
            </button>
            <button
              onClick={toggleExpand}
              className="p-1 hover:bg-gray-600 rounded-full text-gray-300 focus:outline-none"
              style={{ borderRadius: "1.5rem" }}
            >
              <FontAwesomeIcon icon={isExpanded ? faCompress : faExpand} />
            </button>
            <button
              onClick={onToggle}
              className="p-1 hover:bg-gray-600 rounded-full text-gray-300 focus:outline-none"
              style={{ borderRadius: "1.5rem" }}
            >
              {isHidden ? "Göster" : "Sakla"}
            </button>
          </div>
        </div>

        <div className="p-2 flex flex-col h-[calc(100%-42px)]">
          {/* Local Video */}
          <div
            className="relative w-full h-1/2 bg-gray-900 rounded-md mb-2"
            style={{ borderRadius: "1.5rem" }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              muted
              className="absolute top-0 left-0 w-full h-full object-cover rounded-md"
              style={{
                display: isVideoEnabled ? "block" : "none",
                borderRadius: "1.5rem",
              }}
            />
            {!isVideoEnabled && (
              <div
                className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-gray-800 rounded-md"
                style={{ borderRadius: "1.5rem" }}
              >
                <FontAwesomeIcon
                  icon={faVideoSlash}
                  className="text-white text-4xl"
                />
              </div>
            )}
          </div>

          {/* Remote Video */}
          <div
            className="relative w-full h-1/2 bg-gray-900 rounded-md mb-2"
            style={{ borderRadius: "1.5rem" }}
          >
            <video
              ref={remoteVideoRef}
              autoPlay
              className="absolute top-0 left-0 w-full h-full object-cover rounded-md"
              muted={isRemoteAudioMuted}
              style={{ borderRadius: "1.5rem" }}
            />
          </div>

          {/* Butonlar */}
          <div className="flex justify-around items-center mt-2">
            <button
              onClick={toggleAudio}
              className={`p-2 rounded-full hover:bg-gray-600 focus:outline-none ${
                isAudioEnabled
                  ? "bg-green-800 text-green-200"
                  : "bg-red-800 text-red-200"
              }`}
              style={{ borderRadius: "1.5rem" }}
            >
              <FontAwesomeIcon
                icon={isAudioEnabled ? faMicrophone : faMicrophoneSlash}
              />
            </button>

            <button
              onClick={toggleVideo}
              className={`p-2 rounded-full hover:bg-gray-600 focus:outline-none ${
                isVideoEnabled
                  ? "bg-green-800 text-green-200"
                  : "bg-red-800 text-red-200"
              }`}
              style={{ borderRadius: "1.5rem" }}
            >
              <FontAwesomeIcon icon={isVideoEnabled ? faVideo : faVideoSlash} />
            </button>

            {isAudioCallEnabled && (
              <button
                onClick={isCallActive ? endCall : startCall}
                className={`p-2 rounded-full hover:bg-gray-600 focus:outline-none ${
                  isCallActive
                    ? "bg-red-800 text-red-200"
                    : "bg-green-800 text-green-200"
                }`}
                style={{ borderRadius: "1.5rem" }}
              >
                <FontAwesomeIcon icon={isCallActive ? faPhoneSlash : faPhone} />
              </button>
            )}

            {showVideoCall && targetUserId && (
              <button
                onClick={toggleRemoteMute}
                className={`p-2 rounded-full hover:bg-gray-600 focus:outline-none ${
                  isRemoteAudioMuted
                    ? "bg-yellow-800 text-yellow-200"
                    : "bg-blue-800 text-blue-200"
                }`}
                style={{ borderRadius: "1.5rem" }}
              >
                <FontAwesomeIcon
                  icon={isRemoteAudioMuted ? faVolumeMute : faVolumeUp}
                />
              </button>
            )}
          </div>

          {/* Volume Sliders */}
          <div className="flex flex-col mt-6 mb-6 px-2 space-y-4 text-center text-gray-300">
            {/* Mikrofon Ses */}
            <label className="text-sm font-semibold">
              Mikrofon Ses (0-100)
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={micVolume}
              onChange={handleMicVolumeChange}
              className="bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              style={{ borderRadius: "1.5rem" }}
            />

            {/* Karşı Tarafın Sesi */}
            <label className="text-sm font-semibold">Karşı Taraf (0-100)</label>
            <input
              type="range"
              min={0}
              max={100}
              value={remoteVolume}
              onChange={handleRemoteVolumeChange}
              className="bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              style={{ borderRadius: "1.5rem" }}
            />
          </div>
        </div>
      </div>
    </Rnd>
  );
}

export default VideoCall;
