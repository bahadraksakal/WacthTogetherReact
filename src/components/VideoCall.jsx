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
const remoteVideoWidth = 160; // Sabit genişlik değeri
const remoteVideoHeight = 120; // Sabit yükseklik değeri

function VideoCall({
  socket,
  isHidden,
  onToggle,
  showVideoCall,
  isFullScreen,
  isAudioCallEnabled,
  startWithAudio,
  startWithVideo,
}) {
  const localVideoRef = useRef(null);
  const remoteVideosRef = useRef({}); // Birden fazla uzaktan video için ref
  const localStreamRef = useRef(null);
  const [remoteUsersMedia, setRemoteUsersMedia] = useState({}); // Uzak kullanıcıların medya durumları

  const [hasLocalAudio, setHasLocalAudio] = useState(startWithAudio);
  const [hasLocalVideo, setHasLocalVideo] = useState(startWithVideo);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: initialWidth,
    height: initialHeight,
  });
  const [isCallActive, setIsCallActive] = useState(false); // Artık sadece yerel medya açık/kapalı durumunu gösterir
  const [isRemoteAudioMuted, setIsRemoteAudioMuted] = useState({}); // Her kullanıcı için ayrı mute durumu
  const [micVolume, setMicVolume] = useState(100);
  const [remoteVolume, setRemoteVolume] = useState({}); // Her kullanıcı için ayrı ses seviyesi
  const audioContextRef = useRef(null);
  const gainNodeRef = useRef(null);

  // **WebRTC Değişkenleri ve Ref'leri**
  const peerConnectionRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream()); // Uzak kullanıcının stream'i
  const [remoteStreams, setRemoteStreams] = useState({}); // Birden fazla remote stream için state
  const [iceServers, setIceServers] = useState([]); // STUN/TURN sunucu bilgileri

  const toggleAudio = useCallback(() => {
    const newAudioState = !hasLocalAudio;
    setHasLocalAudio(newAudioState);
    if (localStreamRef.current) {
      localStreamRef.current
        .getAudioTracks()
        .forEach((track) => (track.enabled = newAudioState));
    }
    socket.emit("toggle-media", { audio: newAudioState, video: hasLocalVideo });
    console.log(`Yerel mikrofon ${newAudioState ? "açıldı" : "kapandı"}`);
  }, [hasLocalAudio, hasLocalVideo, socket]);

  const toggleVideo = useCallback(() => {
    const newVideoState = !hasLocalVideo;
    setHasLocalVideo(newVideoState);
    if (localStreamRef.current) {
      localStreamRef.current
        .getVideoTracks()
        .forEach((track) => (track.enabled = newVideoState));
    }
    socket.emit("toggle-media", { audio: hasLocalAudio, video: newVideoState });
    console.log(`Yerel kamera ${newVideoState ? "açıldı" : "kapandı"}`);
  }, [hasLocalAudio, hasLocalVideo, socket]);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
    setDimensions((prevState) => ({
      width: prevState.width === "100%" ? initialWidth : "100%",
      height: prevState.height === "100%" ? initialHeight : "100%",
    }));
  }, []);

  const handleResize = useCallback((e, direction, ref, delta, position) => {
    setDimensions({ width: ref.offsetWidth, height: ref.offsetHeight });
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

  const toggleRemoteMute = useCallback(
    (socketId) => {
      setIsRemoteAudioMuted((prev) => ({
        ...prev,
        [socketId]: !prev[socketId],
      }));
      console.log(
        `Uzak kullanıcı ${socketId} için ses ${
          !isRemoteAudioMuted[socketId] ? "susturuldu" : "açıldı"
        }`
      );
    },
    [isRemoteAudioMuted]
  );

  const handleMicVolumeChange = useCallback((e) => {
    const value = parseInt(e.target.value, 10);
    setMicVolume(value);
    if (
      localStreamRef.current &&
      localStreamRef.current.getAudioTracks().length > 0
    ) {
      const audioContext = audioContextRef.current || new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(
        localStreamRef.current
      );
      const gainNode = gainNodeRef.current || audioContext.createGain();
      gainNodeRef.current = gainNode;
      gainNode.gain.value = value / 100;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
    }
  }, []);

  const handleRemoteVolumeChange = useCallback((socketId, value) => {
    setRemoteVolume((prev) => ({ ...prev, [socketId]: value }));
    // Uzak video elementinin sesini ayarla
    if (remoteVideosRef.current[socketId]) {
      remoteVideosRef.current[socketId].volume = value / 100;
    }
  }, []);

  const startCall = useCallback(async () => {
    setIsCallActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: hasLocalAudio,
        video: hasLocalVideo,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // **WebRTC Peer Connection Başlatma**
      createPeerConnection();
      stream
        .getTracks()
        .forEach((track) => peerConnectionRef.current.addTrack(track, stream));
    } catch (error) {
      console.error("Görüşme başlatılamadı:", error);
      Swal.fire(
        "Hata",
        `Görüşme başlatılırken hata oluştu: ${error.message}`,
        "error"
      );
      setIsCallActive(false);
    }
  }, [hasLocalAudio, hasLocalVideo]);

  const endCall = useCallback(() => {
    setIsCallActive(false);
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    }
    // Remote stream'i temizle
    remoteStreamRef.current = new MediaStream();
    setRemoteStreams({});
  }, []);

  const toggleCall = useCallback(() => {
    isCallActive ? endCall() : startCall();
  }, [isCallActive, startCall, endCall]);

  const createPeerConnection = useCallback(() => {
    const config = {
      iceServers: [
        {
          urls: [
            "stun:stun.l.google.com:19302",
            "turn:35.179.115.239:3478?transport=udp",
            "turn:35.179.115.239:3478?transport=tcp",
            "turns:watchtogetherturn.duckdns.org:5349?transport=udp",
            "turns:watchtogetherturn.duckdns.org:5349?transport=tcp",
          ],
          username: "bahadr",
          credential: "bahadr12345",
        },
      ],
      // iceTransportPolicy: "relay",
      // iceCandidatePoolSize: 10,
    };

    peerConnectionRef.current = new RTCPeerConnection(config);

    peerConnectionRef.current.onicecandidate = handleICECandidateEvent;
    peerConnectionRef.current.ontrack = handleTrackEvent;
    peerConnectionRef.current.onnegotiationneeded =
      handleNegotiationNeededEvent;
    peerConnectionRef.current.onconnectionstatechange =
      handleConnectionStateChange;

    // ICE restart özelliği için
    peerConnectionRef.current.addEventListener(
      "iceconnectionstatechange",
      () => {
        if (peerConnectionRef.current.iceConnectionState === "disconnected") {
          peerConnectionRef.current.restartIce();
        }
      }
    );
  }, [iceServers]);

  // **ICE Candidate Handler**
  const handleICECandidateEvent = useCallback(
    (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          to: Object.keys(remoteStreams)[0], // İlk remote user'a gönderiyoruz, çoklu görüşme için düzenlenmeli
        });
      }
    },
    [socket, remoteStreams]
  );

  // **Track Handler**
  const handleTrackEvent = useCallback((event) => {
    console.log("Track event alındı:", event.streams[0]);
    remoteStreamRef.current.addTrack(event.track);
    setRemoteStreams((prevStreams) => ({
      ...prevStreams,
      [Object.keys(prevStreams)[0] || "remoteUser"]: remoteStreamRef.current, // İlk remote user için 'remoteUser' key'i, çoklu görüşme için düzenlenmeli
    }));
  }, []);

  // **Negotiation Needed Handler**
  const handleNegotiationNeededEvent = useCallback(async () => {
    try {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      socket.emit("call-user", {
        signal: offer,
        to: Object.keys(remoteStreams)[0], // İlk remote user'a gönderiyoruz, çoklu görüşme için düzenlenmeli
        from: socket.id,
      });
    } catch (error) {
      console.error("Negotiation needed hatası:", error);
    }
  }, [socket, remoteStreams]);

  // **Connection State Change Handler**
  const handleConnectionStateChange = useCallback(
    (event) => {
      switch (peerConnectionRef.current.connectionState) {
        case "connected":
          console.log("WebRTC bağlantısı başarılı!");
          break;
        case "disconnected":
        case "failed":
          console.log("WebRTC bağlantısı kesildi veya başarısız oldu.");
          endCall(); // Bağlantı kesilirse görüşmeyi sonlandır
          break;
        case "closed":
          console.log("WebRTC bağlantısı kapatıldı.");
          break;
      }
    },
    [endCall]
  );

  useEffect(() => {
    socket.on("user-joined", (user) => {
      console.log(`Yeni kullanıcı katıldı: ${user.username} (ID: ${user.id})`);
      // Yeni kullanıcı katıldığında WebRTC bağlantısı kurmayı başlatabiliriz (isteğe bağlı)
    });

    socket.on("user-left", (socketId) => {
      console.log(`Kullanıcı ayrıldı: ${socketId}`);
      setRemoteUsersMedia((prev) => {
        const newState = { ...prev };
        delete newState[socketId];
        return newState;
      });
      delete remoteVideosRef.current[socketId];
      if (Object.keys(remoteStreams).includes(socketId)) {
        const newRemoteStreams = { ...remoteStreams };
        delete newRemoteStreams[socketId];
        setRemoteStreams(newRemoteStreams);
      }
    });

    socket.on("remote-media-toggled", ({ socketId, audio, video }) => {
      console.log(
        `Uzak kullanıcı medya değiştirdi - ID: ${socketId}, Ses: ${audio}, Video: ${video}`
      );
      setRemoteUsersMedia((prev) => ({
        ...prev,
        [socketId]: { audio, video },
      }));
    });

    // **Yeni: ICE Servers Alındığında**
    socket.on("ice-servers", (servers) => {
      setIceServers(servers);
    });

    // **Yeni: Gelen Arama**
    socket.on("incoming-call", async (payload) => {
      console.log("Gelen arama:", payload);
      const callerSocketId = payload.from;
      const offer = payload.signal;

      if (!peerConnectionRef.current) {
        createPeerConnection(); // Peer connection yoksa oluştur
      }

      try {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(offer)
        );
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        socket.emit("answer-call", { signal: answer, to: callerSocketId });
      } catch (error) {
        console.error("Arama cevaplama hatası:", error);
      }
      setIsCallActive(true); // Arama aktif olarak ayarla
    });

    // **Yeni: Arama Cevaplandığında**
    socket.on("call-accepted", async (signal) => {
      console.log("Arama kabul edildi:", signal);
      try {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(signal)
        );
        startCall(); // Aramayı başlat (medya stream'lerini aç)
        setIsCallActive(true); // Arama aktif olarak ayarla
      } catch (error) {
        console.error("Arama kabul edildiğinde hata:", error);
      }
    });

    // **Yeni: ICE Candidate Alındığında**
    socket.on("ice-candidate", async (candidate) => {
      try {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      } catch (error) {
        console.error("ICE candidate ekleme hatası:", error);
      }
    });

    return () => {
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("remote-media-toggled");
      socket.off("ice-servers");
      socket.off("incoming-call");
      socket.off("call-accepted");
      socket.off("ice-candidate");
    };
  }, [socket, createPeerConnection, startCall, remoteStreams]);

  useEffect(() => {
    // Bağlantı kurulduğunda kendi medya durumunu gönder
    socket.emit("toggle-media", { audio: hasLocalAudio, video: hasLocalVideo });
  }, [socket, hasLocalAudio, hasLocalVideo]);

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
          <div className="mt-2">
            <div className="flex overflow-x-auto">
              {Object.entries(remoteUsersMedia).map(([socketId, media]) => (
                <div
                  key={socketId}
                  className="relative w-full h-1/2 bg-gray-900 object-cover rounded-md mb-2"
                  style={{
                    borderRadius: "1.5rem",
                    width: `${remoteVideoWidth * 2}px`,
                    height: `${remoteVideoHeight * 2}px`,
                  }}
                >
                  <video
                    ref={(el) => (remoteVideosRef.current[socketId] = el)}
                    autoPlay
                    muted={isRemoteAudioMuted[socketId]}
                    className="relative top-0 left-0 w-full h-full object-cover rounded-md"
                    style={{
                      borderRadius: "1.5rem",
                      display: media.video ? "block" : "none",
                    }}
                  />
                  {!media.video && (
                    <div
                      className="relative top-0 left-0 w-full h-full flex items-center justify-center bg-gray-800 rounded-md"
                      style={{ borderRadius: "1.5rem" }}
                    >
                      <FontAwesomeIcon
                        icon={faVideoSlash}
                        className="text-white text-2xl"
                      />
                    </div>
                  )}
                </div>
              ))}
              {/* **Yeni: Remote Streams Video Elementleri** */}
              {Object.entries(remoteStreams).map(([socketId, stream]) => (
                <div
                  key={socketId}
                  className="relative w-full h-1/2 bg-gray-900 object-cover rounded-md mb-2"
                  style={{
                    borderRadius: "1.5rem",
                    width: `${remoteVideoWidth * 2}px`,
                    height: `${remoteVideoHeight * 2}px`,
                  }}
                >
                  <video
                    ref={(el) => (remoteVideosRef.current[socketId] = el)}
                    autoPlay
                    muted={isRemoteAudioMuted[socketId]}
                    className="relative top-0 left-0 w-full h-full object-cover rounded-md"
                    style={{ borderRadius: "1.5rem" }}
                    srcObject={stream} // **Remote stream'i video kaynağı olarak ayarla**
                  />
                </div>
              ))}
            </div>
          </div>
          {/* Remote Videos */}
          <div className="mt-2">
            <div className="flex overflow-x-auto">
              <video
                ref={localVideoRef}
                autoPlay
                muted={!hasLocalAudio}
                className="relative top-50 left-50 w-full h-full object-cover rounded-md"
                style={{
                  display: hasLocalVideo ? "block" : "none",
                  borderRadius: "1.5rem",
                  width: `${remoteVideoWidth}px`,
                  height: `${remoteVideoHeight}px`,
                }}
              />
              {!hasLocalVideo && (
                <div
                  className="relative top-0 left-0 w-full h-full flex items-center justify-center bg-gray-800 rounded-md"
                  style={{ borderRadius: "1.5rem" }}
                >
                  <FontAwesomeIcon
                    icon={faVideoSlash}
                    className="text-white text-4xl"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Butonlar */}
          <div className="flex justify-around items-center mt-2">
            <button
              onClick={toggleAudio}
              className={`p-2 rounded-full hover:bg-gray-600 focus:outline-none ${
                hasLocalAudio
                  ? "bg-green-800 text-green-200"
                  : "bg-red-800 text-red-200"
              }`}
              style={{ borderRadius: "1.5rem" }}
            >
              <FontAwesomeIcon
                icon={hasLocalAudio ? faMicrophone : faMicrophoneSlash}
              />
            </button>
            <button
              onClick={toggleVideo}
              className={`p-2 rounded-full hover:bg-gray-600 focus:outline-none ${
                hasLocalVideo
                  ? "bg-green-800 text-green-200"
                  : "bg-red-800 text-red-200"
              }`}
              style={{ borderRadius: "1.5rem" }}
            >
              <FontAwesomeIcon icon={hasLocalVideo ? faVideo : faVideoSlash} />
            </button>
            <button
              onClick={toggleCall}
              className={`p-2 rounded-full hover:bg-gray-600 focus:outline-none ${
                isCallActive
                  ? "bg-green-800 text-green-200"
                  : "bg-gray-500 text-white"
              }`}
              style={{ borderRadius: "1.5rem" }}
            >
              <FontAwesomeIcon icon={isCallActive ? faPhone : faPhoneSlash} />
            </button>
            {Object.keys(remoteUsersMedia).map((socketId) => (
              <button
                key={socketId}
                onClick={() => toggleRemoteMute(socketId)}
                className={`p-2 rounded-full hover:bg-gray-600 focus:outline-none ${
                  isRemoteAudioMuted[socketId]
                    ? "bg-yellow-800 text-yellow-200"
                    : "bg-blue-800 text-blue-200"
                }`}
                style={{ borderRadius: "1.5rem" }}
              >
                <FontAwesomeIcon
                  icon={
                    isRemoteAudioMuted[socketId] ? faVolumeMute : faVolumeUp
                  }
                />
              </button>
            ))}
          </div>

          {/* Volume Sliders */}
          <div className="flex flex-col mt-6 mb-6 px-2 space-y-4 text-center text-gray-300">
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

            {/* Remote Users Volume Sliders */}
            {Object.keys(remoteUsersMedia).map((socketId) => (
              <div key={socketId}>
                <label className="text-sm font-semibold">
                  {socketId} Ses (0-100)
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={remoteVolume[socketId] || 100}
                  onChange={(e) =>
                    handleRemoteVolumeChange(
                      socketId,
                      parseInt(e.target.value, 10)
                    )
                  }
                  className="bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  style={{ borderRadius: "1.5rem" }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Rnd>
  );
}

export default VideoCall;
