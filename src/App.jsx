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
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";
import "./index.css";
import { url } from "./utils";
import Swal from "sweetalert2";
import LoadingBar from "react-top-loading-bar";

library.add(faVideoIcon, faTimes, faFolderOpen, faPhone, faPhoneSlash, faTrash);

const socket = io(url);

function App() {
  const [username, setUsername] = useState(null);
  const [uploadedVideo, setUploadedVideo] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const videoRef = useRef(null);
  const [userCount, setUserCount] = useState(0);
  const [availableVideos, setAvailableVideos] = useState([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [otherUserId, setOtherUserId] = useState(null);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isAudioCallEnabled] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const loadingBarRef = useRef(null);
  const socketLoadingBarRef = useRef(null);
  const [videoListLoading, setVideoListLoading] = useState(false);

  // Socket bağlantılarını yönet
  useEffect(() => {
    socket.on("connect", () => {
      socketLoadingBarRef.current.continuousStart();
      console.log("Sunucuya bağlandı");
      socketLoadingBarRef.current.complete();
    });
    socket.on("disconnect", () => console.log("Sunucudan ayrıldı"));
    socket.on("connect_error", (err) => {
      console.error("Sunucuya bağlanırken hata oluştu:", err);
      socketLoadingBarRef.current.complete();
      Swal.fire(
        "Hata!",
        "Sunucuya bağlanırken hata oluştu, lütfen tekrar deneyin.",
        "error"
      );
    });
    socket.on("server-full", () =>
      Swal.fire(
        "Sunucu Dolu!",
        "Şu anda sunucu dolu, lütfen daha sonra tekrar deneyin.",
        "warning"
      )
    );

    // Kullanıcılar
    socket.on("existing-users", (users) => {
      setUserCount(users.length);
      if (users.length > 0) {
        const firstUser = users.find((user) => user.id !== socket.id);
        if (firstUser) {
          setOtherUserId(firstUser.id);
        }
      }
    });

    socket.on("user-joined", (data) => {
      console.log("Yeni kullanıcı katıldı:", data);
      setOtherUserId(data.id);
    });

    socket.on("user-left", (socketId) => {
      console.log("Kullanıcı ayrıldı:", socketId);
      if (socketId === otherUserId) {
        setShowVideoCall(false);
        setOtherUserId(null);
      }
    });

    // Video listesi
    socket.on("available-videos", (videos) => {
      setAvailableVideos(videos);
      setVideoListLoading(false);
    });

    // Başka kullanıcı tarafından video seçilince
    socket.on("video-selected", (filename) => {
      console.log("Video seçildi:", filename);
      setUploadedVideo(`${url}/videos/${filename}`);
      setShowSidebar(true);
    });

    // Başka kullanıcı tarafından video silinince
    socket.on("video-deleted", (filename) => {
      setAvailableVideos((prevVideos) =>
        prevVideos.filter((video) => video !== filename)
      );
      if (uploadedVideo === `${url}/videos/${filename}`) {
        setUploadedVideo(null);
      }
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
      socket.emit("volume-change", volume);
    });

    socket.on("upload-start", () => {
      setIsUploading(true);
      loadingBarRef.current.continuousStart();
    });

    socket.on("upload-end", () => {
      setIsUploading(false);
      loadingBarRef.current.complete();
    });

    // **Silindi: incoming-video-call olayı kaldırıldı, yerine "incoming-call" kullanılıyor**
    // socket.on("incoming-video-call", (callerId) => {
    //   Swal.fire({
    //     title: "Görüntülü Arama İsteği",
    //     text: "Bir kullanıcı görüntülü arama yapmak istiyor. Kabul ediyor musunuz?",
    //     icon: "question",
    //     showCancelButton: true,
    //     confirmButtonColor: "#3085d6",
    //     cancelButtonColor: "#d33",
    //     confirmButtonText: "Evet, Kabul Et!",
    //     cancelButtonText: "Hayır",
    //   }).then((result) => {
    //     if (result.isConfirmed) {
    //       setOtherUserId(callerId);
    //       setShowVideoCall(true);
    //     }
    //   });
    // });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("server-full");
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
      socket.off("upload-start");
      socket.off("upload-end");
      // **Silindi: incoming-video-call olayı kaldırıldı**
      // socket.off("incoming-video-call");
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
    Swal.fire({
      title: "Emin misiniz?",
      text: `${filename} adlı videoyu silmek istediğinize emin misiniz?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Evet, Sil!",
      cancelButtonText: "Hayır",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch(`${url}/videos/${filename}`, {
            method: "DELETE",
          });

          if (response.ok) {
            setAvailableVideos((prevVideos) =>
              prevVideos.filter((video) => video !== filename)
            );
            if (uploadedVideo === `${url}/videos/${filename}`) {
              setUploadedVideo(null);
            }
            socket.emit("video-deleted", filename); // Soketle bildir
            Swal.fire("Silindi!", "Video başarıyla silindi.", "success");
          } else {
            const errorData = await response.json();
            Swal.fire(
              "Hata!",
              errorData.message || "Video silinirken bir hata oluştu.",
              "error"
            );
          }
        } catch (error) {
          console.error("Video silme hatası:", error);
          Swal.fire("Hata!", "Video silinirken bir hata oluştu.", "error");
        }
      }
    });
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

  // **Yeni: Arama isteği gönderme fonksiyonu**
  const requestVideoCall = useCallback(() => {
    if (otherUserId) {
      socket.emit("call-user", { to: otherUserId, from: socket.id });
      setShowVideoCall(true); // Arama paneli aç
    } else {
      Swal.fire(
        "Uyarı",
        "Görüntülü arama yapmak için başka bir kullanıcının bağlanmasını bekleyin.",
        "warning"
      );
    }
  }, [otherUserId, socket]);

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
    <div className="min-h-screen bg-gray-100 font-sans">
      <LoadingBar color="#f11946" ref={socketLoadingBarRef} shadow={false} />
      <LoadingBar color="#a0aec0" ref={loadingBarRef} shadow={false} />
      {!username ? (
        <UsernameInput onUsernameSubmit={handleUsernameSubmit} />
      ) : (
        <div className="min-h-screen flex">
          {showSidebar && (
            <aside
              className="bg-gray-200 p-4 w-80 min-h-screen fixed top-0 left-0 shadow-md transform transition-transform duration-300 ease-in-out z-40 rounded-br-xl"
              style={{ borderTopRightRadius: "1.5rem" }}
            >
              <button
                onClick={closeSidebar}
                className="absolute top-4 right-4 bg-gray-300 hover:bg-gray-400 p-2 rounded-md shadow-sm"
                style={{ borderRadius: "1.5rem" }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
              <div className="mt-10 mb-4">Kullanıcılar: {userCount} / 2</div>
              <FileUpload
                onUploadSuccess={handleFileUploadSuccess}
                disabled={isUploading}
                socket={socket}
              />
              <VideoList
                videos={availableVideos}
                onSelect={handleSelectVideo}
                onDelete={handleVideoDelete}
                loading={videoListLoading} // VideoList bileşenine loading propunu gönder
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
                  requestVideoCall={requestVideoCall} // **requestVideoCall fonksiyonunu prop olarak geçir**
                />
              )}
              {/* **VideoCall bileşenini App.js içinde render edin** */}
              {showVideoCall && otherUserId && (
                <VideoCall
                  socket={socket}
                  isHidden={!showVideoCall}
                  onToggle={toggleVideoCall}
                  showVideoCall={showVideoCall}
                  isAudioCallEnabled={isAudioCallEnabled}
                  startWithAudio={true}
                  startWithVideo={true}
                />
              )}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}

export default App;
