// Front/src/App.js
import React, { useState, useRef, useEffect } from "react";
import io from "socket.io-client";
import FileUpload from "./components/FileUpload";
import VideoPlayer from "./components/VideoPlayer";
import VideoCall from "./components/VideoCall";
import UsernameInput from "./components/UsernameInput";
import VideoList from "./components/VideoList";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faVideo as faVideoIcon,
  faTimes,
  faFolderOpen,
  faPhone,
  faPhoneSlash,
  faTrash, // Çöp kutusu ikonu eklendi
} from "@fortawesome/free-solid-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";
import "./index.css";
import { url } from "./utils";

library.add(faVideoIcon, faTimes, faFolderOpen, faPhone, faPhoneSlash, faTrash);

const socket = io(url);

function App() {
  const [username, setUsername] = useState(null);
  const [uploadedVideo, setUploadedVideo] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.5); // Videonun ses seviyesi (0.0 - 1.0)
  const videoRef = useRef(null);
  const [userCount, setUserCount] = useState(0);
  const [availableVideos, setAvailableVideos] = useState([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [otherUserId, setOtherUserId] = useState(null);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isAudioCallEnabled] = useState(true); // Bu propta değişiklik yapmak istersen

  // Socket bağlantılarını yönet
  useEffect(() => {
    socket.on("connect", () => console.log("Sunucuya bağlandı"));
    socket.on("disconnect", () => console.log("Sunucudan ayrıldı"));
    socket.on("connect_error", (err) => {
      console.error("Sunucuya bağlanırken hata oluştu:", err);
      alert("Sunucuya bağlanırken hata oluştu, lütfen tekrar deneyin.");
    });
    socket.on("server-full", () => alert("Sunucu dolu!"));

    // Kullanıcılar
    socket.on("user-connected", (data) => {
      console.log("Kullanıcı bağlandı:", data);
      setUserCount((prevCount) => prevCount + 1);
    });

    socket.on("existing-users", (users) => {
      if (users.length > 0) {
        const firstUser = users[0];
        setOtherUserId(firstUser.id);
        setShowVideoCall(true);
      }
    });

    socket.on("user-joined", (data) => {
      console.log("Yeni kullanıcı katıldı:", data);
      setUserCount((prevCount) => prevCount + 1);
      setOtherUserId(data.id);
      setShowVideoCall(true);
    });

    socket.on("user-left", (socketId) => {
      console.log("Kullanıcı ayrıldı:", socketId);
      setUserCount((prevCount) => Math.max(0, prevCount - 1));
      if (socketId === otherUserId) {
        setShowVideoCall(false);
        setOtherUserId(null);
      }
    });

    // Video listesi
    socket.on("available-videos", (videos) => {
      setAvailableVideos(videos);
    });

    // Başka kullanıcı tarafından video seçilince
    socket.on("video-selected", (filename) => {
      console.log("Video seçildi:", filename);
      setUploadedVideo(`${url}/videos/${filename}`);
      setShowSidebar(true);
    });

    // Mevcut video durumu
    socket.on("video-state", (state) => {
      setIsPlaying(state.isPlaying);
      setCurrentTime(state.currentTime);
      setMuted(state.muted);
      setVolume(state.volume);

      if (
        videoRef.current &&
        Math.abs(videoRef.current.currentTime - state.currentTime) > 0.5
      ) {
        videoRef.current.currentTime = state.currentTime;
      }
      if (videoRef.current) {
        videoRef.current.muted = state.muted;
        videoRef.current.volume = state.volume;
      }
      // Oynatma / durdurma
      if (videoRef.current && state.isPlaying && videoRef.current.paused) {
        videoRef.current
          .play()
          .catch((e) => console.error("Oynatma hatası:", e));
      } else if (
        videoRef.current &&
        !state.isPlaying &&
        !videoRef.current.paused
      ) {
        videoRef.current.pause();
      }
    });

    // Video oynatma-kontrol olayları
    socket.on("play", () => {
      setIsPlaying(true);
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current
          .play()
          .catch((e) => console.error("Oynatma hatası:", e));
      }
    });

    socket.on("pause", () => {
      setIsPlaying(false);
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    });

    socket.on("seek", (time) => {
      setCurrentTime(time);
      if (
        videoRef.current &&
        Math.abs(videoRef.current.currentTime - time) > 0.5
      ) {
        videoRef.current.currentTime = time;
      }
    });

    socket.on("mute", () => {
      setMuted(true);
      if (videoRef.current) {
        videoRef.current.muted = true;
      }
    });

    socket.on("unmute", () => {
      setMuted(false);
      if (videoRef.current) {
        videoRef.current.muted = false;
      }
    });

    socket.on("volume-change", (volume) => {
      setVolume(volume);
      if (videoRef.current) {
        videoRef.current.volume = volume;
      }
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("server-full");
      socket.off("user-connected");
      socket.off("existing-users");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("available-videos");
      socket.off("video-selected");
      socket.off("video-state");
      socket.off("play");
      socket.off("pause");
      socket.off("seek");
      socket.off("mute");
      socket.off("unmute");
      socket.off("volume-change");
    };
  }, [otherUserId]);

  // Kullanıcı adını al
  const handleUsernameSubmit = (uname) => {
    setUsername(uname);
    socket.emit("user-join", uname);
  };

  // Dosya yükleme
  const handleFileUploadSuccess = (filename) => {
    setAvailableVideos((prev) => [...prev, filename]);
    if (!uploadedVideo) {
      setShowFileUpload(false);
      setShowSidebar(true);
    }
  };

  // Video silme işlemi
  const handleVideoDelete = async (filename) => {
    try {
      const response = await fetch(`${url}/videos/${filename}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setAvailableVideos((prevVideos) =>
          prevVideos.filter((video) => video !== filename)
        );
        if (uploadedVideo === `${url}/videos/${filename}`) {
          setUploadedVideo(null); // Eğer silinen video oynatılıyorsa temizle
        }
      } else {
        const errorData = await response.json();
        alert(errorData.message || "Video silinirken bir hata oluştu.");
      }
    } catch (error) {
      console.error("Video silme hatası:", error);
      alert("Video silinirken bir hata oluştu.");
    }
  };

  // Video kontrol fonksiyonları
  const handlePlay = () => {
    socket.emit("play");
  };

  const handlePause = () => {
    socket.emit("pause");
  };

  const handleSeek = (time) => {
    socket.emit("seek", time);
  };

  const handleMute = () => {
    socket.emit("mute");
  };

  const handleUnmute = () => {
    socket.emit("unmute");
  };

  const handleVolumeChange = (volume) => {
    setVolume(volume);
    socket.emit("volume-change", volume);
  };

  const handleSelectVideo = (filename) => {
    console.log("Video seçiliyor:", filename);
    socket.emit("select-video", filename);
  };

  // Sidebar kontrolü
  const closeSidebar = () => {
    setShowSidebar(false);
  };

  const toggleSidebar = () => {
    setShowSidebar((prev) => !prev);
  };

  // VideoCall panelini aç-kapa
  const toggleVideoCall = () => {
    setShowVideoCall((prev) => !prev);
  };

  // Fullscreen değişikliğini kontrol et
  const handleFullScreenChange = () => {
    setIsFullScreen(!!document.fullscreenElement);
  };

  useEffect(() => {
    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {!username ? (
        <UsernameInput onUsernameSubmit={handleUsernameSubmit} />
      ) : (
        <div className="min-h-screen flex">
          {showSidebar && (
            <aside className="bg-gray-200 p-4 w-80 min-h-screen fixed top-0 left-0 shadow-md transform transition-transform duration-200 ease-in-out z-40">
              <button
                onClick={closeSidebar}
                className="absolute top-4 right-4 bg-gray-300 hover:bg-gray-400 p-2 rounded-md shadow-sm"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
              <div className="mt-10 mb-4">Kullanıcılar: {userCount} / 2</div>
              <FileUpload onUploadSuccess={handleFileUploadSuccess} />
              <VideoList
                videos={availableVideos}
                onSelect={handleSelectVideo}
                onDelete={handleVideoDelete} // Silme fonksiyonu prop olarak gönderildi
              />
            </aside>
          )}

          <main
            className={`flex-grow p-6 ${
              showSidebar ? "ml-80" : ""
            } transition-all duration-300`}
          >
            <div className="relative">
              {uploadedVideo && (
                <VideoPlayer
                  videoUrl={uploadedVideo}
                  isPlaying={isPlaying}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onSeek={handleSeek}
                  muted={muted}
                  onMute={handleMute}
                  onUnmute={handleUnmute}
                  videoRef={videoRef}
                  volume={volume}
                  onVolumeChange={handleVolumeChange}
                  toggleSidebar={toggleSidebar}
                  toggleVideoCall={toggleVideoCall}
                  showVideoCall={showVideoCall}
                  socket={socket}
                  isAudioCallEnabled={isAudioCallEnabled}
                  otherUserId={otherUserId}
                />
              )}
              {/* VideoCall bileşeni  artık playeriçinden çağrılıyor.*/}
              {/* {showVideoCall && otherUserId && (
                <VideoCall
                  socket={socket}
                  targetUserId={otherUserId}
                  showVideoCall={showVideoCall}
                  isAudioCallEnabled={isAudioCallEnabled}
                  startWithAudio={true} // Ses varsayılan olarak açık
                  startWithVideo={true} // Kamera varsayılan olarak açık
                />
              )} */}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}

export default App;
