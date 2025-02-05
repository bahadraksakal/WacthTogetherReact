// Front/src/components/VideoPlayer.js
import React, { useCallback, useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faPause,
  faVolumeUp,
  faVolumeMute,
  faExpand,
  faCompress,
  faFolderOpen,
  faVideo as faVideoIcon,
  faPhone as faPhoneIcon,
} from "@fortawesome/free-solid-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";
import VideoCall from "./VideoCall";

library.add(
  faPlay,
  faPause,
  faVolumeUp,
  faVolumeMute,
  faExpand,
  faCompress,
  faFolderOpen,
  faVideoIcon,
  faPhoneIcon,
);

// Yardımcı fonksiyon: zaman formatlama
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${sec}`;
}

function VideoPlayer({
  videoUrl,
  isPlaying,
  onPlay,
  onPause,
  onSeek,
  muted,
  onMute,
  onUnmute,
  videoRef,
  volume,
  onVolumeChange,
  toggleSidebar,
  toggleVideoCall,
  showVideoCall,
  socket,
  isAudioCallEnabled,
  otherUserId,
  requestVideoCall,
}) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeout = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [localIsPlaying, setLocalIsPlaying] = useState(isPlaying);

  // Prop değiştiğinde state'i güncelle
  useEffect(() => {
    setLocalIsPlaying(isPlaying);
  }, [isPlaying]);

  // Play/Pause butonuna basıldığında
  const handlePlayPause = useCallback(() => {
    localIsPlaying ? onPause() : onPlay();
  }, [localIsPlaying, onPause, onPlay]);

  // Video zaman güncellemesi
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      setCurrentTime(currentTime);
      // Direkt zamanı ilet (2 saniyede bir throttle)
      if (Date.now() - lastUpdate > 2000) {
        socket.volatile.emit("time-update", currentTime);
        setLastUpdate(Date.now());
      }
    }
  }, [socket]);

  // Mute/Unmute
  const handleMuteUnmute = useCallback(() => {
    muted ? onUnmute() : onMute();
  }, [muted, onMute, onUnmute]);

  // Seek bar
  const handleSeekChange = useCallback(
    (event) => {
      onSeek(parseFloat(event.target.value));
    },
    [onSeek],
  );

  // Ses seviyesi değişikliği (0 - 1 arası)
  const handleVolumeChangeLocal = useCallback(
    (event) => {
      onVolumeChange(parseFloat(event.target.value));
    },
    [onVolumeChange],
  );

  // Fullscreen aç/kapa
  const toggleFullScreen = useCallback(() => {
    const videoPlayerElement = videoRef.current?.parentElement;
    if (!document.fullscreenElement) {
      videoPlayerElement?.requestFullscreen();
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
    setShowControls(true); // Fullscreen geçişte kontrolleri göster
  }, []);

  // Kontrolleri gizleme fonksiyonu
  const hideControls = useCallback(() => {
    setShowControls(false);
  }, []);

  // Fare hareket ettiğinde kontrolleri göster ve zamanlayıcıyı sıfırla
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(hideControls, 3000); // 3 saniye sonra gizle
  }, [hideControls]);

  // Kontrol çubuğu üzerinde fare hareket ettiğinde zamanlayıcıyı temizle
  const handleControlMouseOver = useCallback(() => {
    clearTimeout(controlsTimeout.current);
    setShowControls(true); // Kontrol çubuğundayken kontrolleri açık tut
  }, []);

  // Kontrol çubuğu dışına fare çıktığında zamanlayıcıyı yeniden başlat
  const handleControlMouseOut = useCallback(() => {
    controlsTimeout.current = setTimeout(hideControls, 3000); // 3 saniye sonra gizle
  }, [hideControls]);

  // Video üzerine tıklandığında oynat/duraklat ve kontrolleri göster/gizle
  const handleVideoClick = useCallback(() => {
    handlePlayPause();
    setShowControls(!showControls); // Kontrollerin görünürlüğünü değiştir
    if (!showControls) {
      clearTimeout(controlsTimeout.current); // Eğer kontroller gösteriliyorsa, zamanlayıcıyı temizle
      controlsTimeout.current = setTimeout(hideControls, 3000); // ve 3 saniye sonra tekrar gizle
    }
  }, [handlePlayPause, showControls, hideControls]);

  // Video yüklendiğinde süreyi güncelle
  const handleLoadedMetadata = useCallback(() => {
    setCurrentTime(0); // Video başladığında süreyi sıfırla
  }, []);

  // Video state dinleyicisi (senkronizasyon için)
  useEffect(() => {
    const handleVideoState = (state) => {
      if (videoRef.current && state.lastUpdatedBy !== socket.id) {
        // 1 saniyeden fazla fark varsa senkronize et
        if (Math.abs(videoRef.current.currentTime - state.currentTime) > 1) {
          videoRef.current.currentTime = state.currentTime;
        }

        // Oynatma durumunu senkronize et
        if (state.isPlaying !== localIsPlaying) {
          state.isPlaying ? videoRef.current.play() : videoRef.current.pause();
          setLocalIsPlaying(state.isPlaying);
        }

        // Ses ayarlarını senkronize et
        videoRef.current.volume = state.volume;
        videoRef.current.muted = state.muted;
      }
    };

    if (socket) socket.on("video-state", handleVideoState);

    return () => {
      if (socket) socket.off("video-state", handleVideoState);
    };
  }, [socket, localIsPlaying]);

  return (
    <div
      className="relative flex-grow bg-black flex flex-col justify-center items-center mx-2"
      onMouseMove={showControls ? handleMouseMove : undefined}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain"
        onClick={handleVideoClick}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        muted={muted}
        volume={volume}
        controls={false}
      />

      {/* Geliştirilmiş Kontrol Çubuğu */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        } flex p-3 justify-between items-center`}
        onMouseOver={handleControlMouseOver}
        onMouseOut={handleControlMouseOut}
      >
        <div className="flex items-center space-x-3">
          {/* Play/Pause Butonu - daha büyük ikonlar ve beyaz renk */}
          <button
            onClick={handlePlayPause}
            className="text-white hover:text-gray-300 focus:outline-none"
          >
            <FontAwesomeIcon
              icon={localIsPlaying ? faPause : faPlay}
              size="lg"
            />
          </button>

          {/* Ses Kontrol Butonu - beyaz renk */}
          <button
            onClick={handleMuteUnmute}
            className="text-white hover:text-gray-300 focus:outline-none"
          >
            <FontAwesomeIcon
              icon={muted ? faVolumeMute : faVolumeUp}
              size="lg"
            />
          </button>

          {/* Ses Slider - daha belirgin stil */}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChangeLocal}
            className="w-24 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer accent-white"
          />

          {/* Mevcut Zaman - beyaz renk */}
          <span className="text-white text-sm">{formatTime(currentTime)}</span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Seek Slider - daha belirgin stil */}
          <input
            type="range"
            min="0"
            max={videoRef.current?.duration || 0}
            step="0.1"
            value={currentTime}
            onChange={handleSeekChange}
            className="flex-grow h-1 bg-gray-600 rounded-full appearance-none cursor-pointer accent-white"
          />

          {/* Toplam Süre - beyaz renk */}
          <span className="text-white text-sm">
            / {formatTime(videoRef.current?.duration || 0)}
          </span>

          {/* Fullscreen Butonu - beyaz renk */}
          <button
            onClick={toggleFullScreen}
            className="text-white hover:text-gray-300 focus:outline-none"
          >
            <FontAwesomeIcon
              icon={isFullScreen ? faCompress : faExpand}
              size="lg"
            />
          </button>
        </div>
      </div>

      {/* Klasör Butonu (Video Listesi) */}
      <button
        onClick={toggleSidebar}
        className={`absolute top-2 left-2 bg-purple-800 hover:bg-purple-900 text-white font-bold py-1 px-2 rounded-full focus:outline-none shadow z-[100] text-sm ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
        style={{ zIndex: 100, borderRadius: "1.5rem" }}
      >
        <FontAwesomeIcon icon={faFolderOpen} />
      </button>

      {/* VideoCall Butonu */}
      <button
        onClick={toggleVideoCall}
        className={`absolute top-2 right-2 bg-blue-800 hover:bg-blue-900 text-white font-bold py-1 px-2 rounded-full focus:outline-none shadow z-[100] text-sm ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
        style={{ zIndex: 100, borderRadius: "1.5rem" }}
      >
        <FontAwesomeIcon icon={faVideoIcon} />
      </button>
      {/* Arama Butonu */}
      {/* <button
        onClick={requestVideoCall}
        className={`absolute top-2 right-2 bg-green-800 hover:bg-green-900 text-white font-bold py-1 px-2 rounded-full focus:outline-none shadow z-[100] text-sm ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
        style={{ zIndex: 100, borderRadius: "1.5rem" }}
      >
        <FontAwesomeIcon icon={faPhoneIcon} />
      </button> */}

      {/* VideoCall bileşeni */}
      {showVideoCall && (
        <VideoCall
          socket={socket}
          targetUserId={otherUserId}
          showVideoCall={showVideoCall}
          isAudioCallEnabled={isAudioCallEnabled}
          startWithAudio={true}
          startWithVideo={true}
        />
      )}
    </div>
  );
}

export default VideoPlayer;
