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

  // Yeni eklenen state'ler
  const [micVolume, setMicVolume] = useState(100); // 0-100
  const [remoteVolume, setRemoteVolume] = useState(100); // 0-100

  // GainNode vb. için saklama
  const audioContextRef = useRef(null);
  const gainNodeRef = useRef(null);

  // RTCPeerConnection configuration
  const configuration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      // Ek ICE sunucuları eklenebilir
    ],
  };

  // Ses aç-kapa
  const toggleAudio = useCallback(() => {
    setIsAudioEnabled((prev) => !prev);
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      localVideoRef.current.srcObject
        .getAudioTracks()
        .forEach((track) => (track.enabled = !track.enabled));
    }
  }, []);

  // Video aç-kapa
  const toggleVideo = useCallback(() => {
    setIsVideoEnabled((prev) => !prev);
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      localVideoRef.current.srcObject
        .getVideoTracks()
        .forEach((track) => (track.enabled = !track.enabled));
    }
  }, []);

  // Görüşmeyi büyült/küçült
  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
    setDimensions((prevState) => ({
      width: prevState.width === "100%" ? initialWidth : "100%",
      height: prevState.height === "100%" ? initialHeight : "100%",
    }));
  }, []);

  // Boyutlandırma
  const handleResize = useCallback((e, direction, ref, delta, position) => {
    setDimensions({
      width: ref.offsetWidth,
      height: ref.offsetHeight,
    });
  }, []);

  // Pencereyi büyüt
  const increaseSize = useCallback(() => {
    setDimensions((prev) => ({
      width: prev.width + 50,
      height: prev.height + 50,
    }));
  }, []);

  // Pencereyi küçült
  const decreaseSize = useCallback(() => {
    setDimensions((prev) => ({
      width: Math.max(150, prev.width - 50),
      height: Math.max(150, prev.height - 50),
    }));
  }, []);

  // Karşı tarafın sesini kapat/aç (bizim tarafımızda)
  const toggleRemoteMute = useCallback(() => {
    setIsRemoteAudioMuted((prev) => !prev);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !isRemoteAudioMuted;
    }
  }, [isRemoteAudioMuted]);

  // MIC ve Uzak Ses Slider
  const handleMicVolumeChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setMicVolume(value);
    // GainNode ayarı (0 - 1)
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = value / 100;
    }
  };

  const handleRemoteVolumeChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setRemoteVolume(value);
    // Remote video volume ayarı
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = value / 100;
    }
  };

  // WebRTC aramasını başlat
  const startCall = useCallback(async () => {
    if (!targetUserId) {
      alert("Bağlanacak başka bir kullanıcı yok.");
      return;
    }

    // Eğer zaten aktif bir bağlantı varsa, önce kapatalım
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    try {
      // Hem video hem de audio stream al
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoEnabled,
        audio: isAudioEnabled,
      });

      // AudioContext + GainNode ile mikrofon sesini düzenle
      audioContextRef.current = new AudioContext();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.gain.value = micVolume / 100;

      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();

      // Eğer ses varsa gain node ekle
      if (audioTracks.length > 0) {
        const audioSource = audioContextRef.current.createMediaStreamSource(
          new MediaStream([audioTracks[0]])
        );
        audioSource.connect(gainNodeRef.current);
      }

      const destination =
        audioContextRef.current.createMediaStreamDestination();
      gainNodeRef.current.connect(destination);

      // Yeni bir stream oluştur: gainNode'dan gelen ses + video track
      const combinedStream = new MediaStream([
        ...destination.stream.getAudioTracks(),
        ...videoTracks,
      ]);

      // localVideoRef'e göster
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = combinedStream;
      }

      // PeerConnection
      const peerConnection = new RTCPeerConnection(configuration);
      peerConnectionRef.current = peerConnection;

      // Tüm track'leri ekle
      combinedStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, combinedStream);
      });

      // Remote track yakalama
      peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.volume = remoteVolume / 100;
        }
      };

      // ICE adaylarını yönet
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            target: targetUserId,
            candidate: event.candidate,
          });
        }
      };

      // Teklif oluştur
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Teklifi karşı tarafa gönder
      socket.emit("offer", {
        target: targetUserId,
        offer: offer,
      });

      setIsCallActive(true);
    } catch (error) {
      console.error("Arama başlatılamadı:", error);
      alert("Kamera veya mikrofona erişimde sorun var. İzinleri kontrol edin.");
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

  // Görüşmeyi bitir
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

  // Teklif (offer) geldiğinde
  useEffect(() => {
    const handleOffer = async (data) => {
      const { from, offer } = data;
      if (!from) {
        console.error("Teklif gönderen yok.");
        return;
      }

      // Mevcut bağlantıyı kapatalım (varsayılan iyileştirme)
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      try {
        // local stream alalım
        const stream = await navigator.mediaDevices.getUserMedia({
          video: isVideoEnabled,
          audio: isAudioEnabled,
        });

        // AudioContext + GainNode
        audioContextRef.current = new AudioContext();
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.gain.value = micVolume / 100;

        const audioTracks = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();

        if (audioTracks.length > 0) {
          const audioSource = audioContextRef.current.createMediaStreamSource(
            new MediaStream([audioTracks[0]])
          );
          audioSource.connect(gainNodeRef.current);
        }

        const destination =
          audioContextRef.current.createMediaStreamDestination();
        gainNodeRef.current.connect(destination);

        const combinedStream = new MediaStream([
          ...destination.stream.getAudioTracks(),
          ...videoTracks,
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

        // Yanıt (answer) oluştur
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Karşı tarafa answer gönder
        socket.emit("answer", {
          target: from,
          answer: answer,
        });

        setIsCallActive(true);
      } catch (error) {
        console.error("Teklif işlenirken hata:", error);
        alert(
          "Kamera veya mikrofona erişimde sorun var. İzinleri kontrol edin."
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
      }
    };

    const handleIceCandidate = async (data) => {
      const { from, candidate } = data;
      if (!from || !peerConnectionRef.current) {
        console.error("ICE candidate hedefi yok veya aktif bağlantı yok.");
        return;
      }
      try {
        // Bağlantı kapalı değilse ICE adayı ekle
        if (peerConnectionRef.current.signalingState !== "closed") {
          await peerConnectionRef.current.addIceCandidate(candidate);
        }
      } catch (error) {
        console.error("ICE adayı eklenirken hata:", error);
      }
    };

    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIceCandidate);

    return () => {
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIceCandidate);
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
      <div className="bg-gray-800 rounded-md h-full shadow-md">
        <div className="bg-gray-700 border-b border-gray-600 flex justify-between items-center p-2 cursor-move text-white">
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
              className="p-1 hover:bg-gray-600 rounded-full text-gray-300"
            >
              <FontAwesomeIcon icon={faPlus} />
            </button>
            <button
              onClick={decreaseSize}
              className="p-1 hover:bg-gray-600 rounded-full text-gray-300"
            >
              <FontAwesomeIcon icon={faMinus} />
            </button>
            <button
              onClick={toggleExpand}
              className="p-1 hover:bg-gray-600 rounded-full text-gray-300"
            >
              <FontAwesomeIcon icon={isExpanded ? faCompress : faExpand} />
            </button>
            <button
              onClick={onToggle}
              className="p-1 hover:bg-gray-600 rounded-full text-gray-300"
            >
              {isHidden ? "Göster" : "Sakla"}
            </button>
          </div>
        </div>

        <div className="p-2 flex flex-col h-[calc(100%-42px)]">
          {/* Local Video */}
          <div className="relative w-full h-1/2 bg-gray-900 rounded-md mb-2">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              className="absolute top-0 left-0 w-full h-full object-cover"
              style={{ display: isVideoEnabled ? "block" : "none" }}
            />
          </div>

          {/* Remote Video */}
          <div className="relative w-full h-1/2 bg-gray-900 rounded-md mb-2">
            <video
              ref={remoteVideoRef}
              autoPlay
              className="absolute top-0 left-0 w-full h-full object-cover"
              muted={isRemoteAudioMuted} // local tarafta susturma
            />
          </div>

          {/* Butonlar */}
          <div className="flex justify-around items-center mt-2">
            {/* Mik.mute/unmute */}
            <button
              onClick={toggleAudio}
              className={`p-2 rounded-full hover:bg-gray-600 ${
                isAudioEnabled
                  ? "bg-green-800 text-green-200"
                  : "bg-red-800 text-red-200"
              }`}
            >
              <FontAwesomeIcon
                icon={isAudioEnabled ? faMicrophone : faMicrophoneSlash}
              />
            </button>

            {/* Video aç/kapa */}
            <button
              onClick={toggleVideo}
              className={`p-2 rounded-full hover:bg-gray-600 ${
                isVideoEnabled
                  ? "bg-green-800 text-green-200"
                  : "bg-red-800 text-red-200"
              }`}
            >
              <FontAwesomeIcon icon={isVideoEnabled ? faVideo : faVideoSlash} />
            </button>

            {/* Arama başlat/bitir */}
            {isAudioCallEnabled && (
              <button
                onClick={isCallActive ? endCall : startCall}
                className={`p-2 rounded-full hover:bg-gray-600 ${
                  isCallActive
                    ? "bg-red-800 text-red-200"
                    : "bg-green-800 text-green-200"
                }`}
              >
                <FontAwesomeIcon icon={isCallActive ? faPhoneSlash : faPhone} />
              </button>
            )}

            {/* Remote Mute */}
            {showVideoCall && targetUserId && (
              <button
                onClick={toggleRemoteMute}
                className={`p-2 rounded-full hover:bg-gray-600 ${
                  isRemoteAudioMuted
                    ? "bg-yellow-800 text-yellow-200"
                    : "bg-blue-800 text-blue-200"
                }`}
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
            />
          </div>
        </div>
      </div>
    </Rnd>
  );
}

export default VideoCall;
