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

  const toggleCall = useCallback(async () => {
    setIsCallActive((prevState) => !prevState);
    if (!isCallActive) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: hasLocalAudio,
          video: hasLocalVideo,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Görüşme başlatılamadı:", error);
        Swal.fire(
          "Hata",
          `Görüşme başlatılırken hata oluştu: ${error.message}`,
          "error"
        );
        setIsCallActive(false); // Hata durumunda butonu geri al
      }
    } else {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
      }
    }
  }, [isCallActive, hasLocalAudio, hasLocalVideo]);

  useEffect(() => {
    socket.on("user-joined", (user) => {
      console.log(`Yeni kullanıcı katıldı: ${user.username} (ID: ${user.id})`);
    });

    socket.on("user-left", (socketId) => {
      console.log(`Kullanıcı ayrıldı: ${socketId}`);
      setRemoteUsersMedia((prev) => {
        const newState = { ...prev };
        delete newState[socketId];
        return newState;
      });
      delete remoteVideosRef.current[socketId];
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

    return () => {
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("remote-media-toggled");
    };
  }, [socket]);

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
