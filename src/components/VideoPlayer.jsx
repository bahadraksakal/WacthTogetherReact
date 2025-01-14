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
  faVideoIcon
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

}) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeout = useRef(null);

  // Play/Pause butonuna basıldığında
  const handlePlayPause = useCallback(() => {
    isPlaying ? onPause() : onPlay();
  }, [isPlaying, onPause, onPlay]);

  // Video zaman güncellemesi
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      onSeek(videoRef.current.currentTime);
    }
  }, [onSeek, videoRef]);

  // Mute/Unmute
  const handleMuteUnmute = useCallback(() => {
    muted ? onUnmute() : onMute();
  }, [muted, onMute, onUnmute]);

  // Seek bar
  const handleSeekChange = useCallback(
    (event) => {
      onSeek(parseFloat(event.target.value));
    },
    [onSeek]
  );

  // Ses seviyesi değişikliği (0 - 1 arası)
  const handleVolumeChangeLocal = useCallback(
    (event) => {
      onVolumeChange(parseFloat(event.target.value));
    },
    [onVolumeChange]
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
  }, [videoRef]);

  // Kontrolleri gizle/göster
  const resetControlsTimeout = useCallback(() => {
    clearTimeout(controlsTimeout.current);
    setShowControls(true);
    controlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const handleMouseMove = useCallback(() => {
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
      if (document.fullscreenElement) {
        resetControlsTimeout();
      } else {
        clearTimeout(controlsTimeout.current);
        setShowControls(true);
      }
    };

    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
      clearTimeout(controlsTimeout.current);
    };
  }, [resetControlsTimeout]);

  // Ekran fullscreen olduğunda fare hareketini takip et
  useEffect(() => {
    if (isFullScreen) {
      document.addEventListener("mousemove", handleMouseMove);
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      clearTimeout(controlsTimeout.current);
      setShowControls(true);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isFullScreen, handleMouseMove]);

  return (
    <div
      className="bg-gray-800 rounded-md shadow-lg overflow-hidden relative h-[calc(100vh-6vh)]"
      onMouseMove={handleMouseMove}
      id="video-call-comp"
    >
      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full bg-black cursor-pointer object-contain"
          onTimeUpdate={handleTimeUpdate}
          onClick={handlePlayPause}
        />
      )}

      {/* Kontrol Çubuğu */}
      <div
        className={`p-4 flex items-center absolute bottom-0 left-0 w-full bg-gray-800 bg-opacity-75 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-center space-x-4 flex-grow">
          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            className="text-white hover:text-gray-300 focus:outline-none"
          >
            <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} size="lg" />
          </button>

          {/* Mute/Unmute */}
          <button
            onClick={handleMuteUnmute}
            className="text-white hover:text-gray-300 focus:outline-none"
          >
            <FontAwesomeIcon
              icon={muted ? faVolumeMute : faVolumeUp}
              size="lg"
            />
          </button>

          {/* Volume Slider (0 - 1) */}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChangeLocal}
            className="w-16"
          />

          {/* Current Time */}
          <span className="text-white text-sm">
            {formatTime(videoRef.current?.currentTime || 0)}
          </span>

          {/* Seek Slider */}
          <input
            type="range"
            min="0"
            max={videoRef.current?.duration || 0}
            step="0.1"
            value={videoRef.current?.currentTime || 0}
            onChange={handleSeekChange}
            className="flex-grow"
          />

          {/* Duration */}
          <span className="text-white text-sm">
            / {formatTime(videoRef.current?.duration || 0)}
          </span>

          {/* Fullscreen */}
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
        style={{ zIndex: 100 }}
      >
        <FontAwesomeIcon icon={faFolderOpen} />
      </button>

      {/* VideoCall Butonu */}
      <button
        onClick={toggleVideoCall}
        className={`absolute top-2 right-2 bg-blue-800 hover:bg-blue-900 text-white font-bold py-1 px-2 rounded-full focus:outline-none shadow z-[100] text-sm ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
        style={{ zIndex: 100 }}
      >
        <FontAwesomeIcon icon={faVideoIcon} />
      </button>
      {/* VideoCall bileşeni */}
      {showVideoCall && otherUserId && (
            <VideoCall
              socket={socket}
              isHidden={!showVideoCall}
              onToggle={toggleVideoCall}
              showVideoCall={showVideoCall}
              isFullScreen={isFullScreen}
              isAudioCallEnabled={isAudioCallEnabled}
              targetUserId={otherUserId}
              startWithAudio={true} // Başlangıçta sesli
              startWithVideo={true} // Başlangıçta kameralı
            />
          )}
    </div>
  );
}

export default VideoPlayer;
