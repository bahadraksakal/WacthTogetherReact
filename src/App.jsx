// Front/src/App.js
import React, { useState, useRef, useEffect, useCallback } from "react";
import io from "socket.io-client";
import FileUpload from "./components/FileUpload";
import VideoPlayer from "./components/VideoPlayer";
import VideoCall from "./components/VideoCall";
import UsernameInput from "./components/UsernameInput";
import VideoList from "./components/VideoList";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faVideo,
  faFilm,
  faUsers,
  faSignOutAlt,
  faFileUpload,
} from "@fortawesome/free-solid-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";
import "./index.css";
import { url, socketOptions } from "./utils";
import Swal from "sweetalert2";
import LoadingBar from "react-top-loading-bar";

library.add(faVideo, faFilm, faUsers, faSignOutAlt, faFileUpload);

function App() {
  const [username, setUsername] = useState(
    localStorage.getItem("username") || ""
  );
  const [uploadedVideo, setUploadedVideo] = useState(null);
  const [availableVideos, setAvailableVideos] = useState([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [videoListLoading, setVideoListLoading] = useState(true);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [otherUserId, setOtherUserId] = useState(null);
  const [isAudioCallEnabled, setIsAudioCallEnabled] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [socketStatus, setSocketStatus] = useState("disconnected");
  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const socketLoadingBarRef = useRef(null);
  const loadingBarRef = useRef(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [networkStatus, setNetworkStatus] = useState(navigator.onLine);
  const maxReconnectAttempts = 5;

  const socket = useRef(null);

  useEffect(() => {
    if (!socketLoadingBarRef.current || !loadingBarRef.current) {
      return;
    }

    try {
      socket.current = io(url, socketOptions);
      socketRef.current = socket.current;

      socket.current.on("connect", () => {
        setSocketStatus("connected");
        if (socketLoadingBarRef.current) {
          socketLoadingBarRef.current.continuousStart();
          console.log("Sunucuya bağlandı");
          socketLoadingBarRef.current.complete();
        }
        setIsLoading(false);
      });

      socket.current.on("video-state", (state) => {
        if (state.lastUpdatedBy === socket.current.id) return;
        setIsPlaying(state.isPlaying);
        if (videoRef.current) {
          if (state.isPlaying) {
            if (videoRef.current.paused) {
              videoRef.current
                .play()
                .catch((e) => console.error("Oynatma hatası:", e));
            }
          } else {
            if (!videoRef.current.paused) videoRef.current.pause();
          }
          videoRef.current.currentTime = state.currentTime;
        }
        setVolume(state.volume);
      });

      socket.current.on("existing-users", (users) => {
        setUserCount(users.length);
        if (users.length > 0) {
          const firstUser = users.find((user) => user.id !== socket.current.id);
          if (firstUser) {
            setOtherUserId(firstUser.id);
          }
        }
      });

      socket.current.on("user-joined", (data) => {
        Swal.fire({
          title: `${data.username} katıldı!`,
          icon: "info",
          timer: 2000,
        });
      });

      socket.current.on("user-updated", (updatedUsers) => {
        setUserCount(updatedUsers.length);
        setUsers(updatedUsers);
        setOtherUserId(
          updatedUsers.find((u) => u.id !== socket.current.id)?.id || null
        );
      });

      socket.current.on("disconnect", () => {
        setSocketStatus("disconnected");
        console.log("Sunucudan ayrıldı");
        Swal.fire({
          title: "Bağlantı Kesildi",
          text: "Sunucu bağlantısı kesildi. Yeniden bağlanılıyor...",
          icon: "warning",
          timer: 3000,
        });
      });

      socket.current.on("server-full", () =>
        Swal.fire(
          "Sunucu Dolu!",
          "Şu anda sunucu dolu. Lütfen daha sonra tekrar deneyin.",
          "warning"
        )
      );

      socket.current.on("available-videos", (videos) => {
        setAvailableVideos(videos);
        setVideoListLoading(false);
      });

      socket.current.on("video-selected", (filename) => {
        console.log("Video seçildi:", filename);
        setUploadedVideo(`${url}/videos/${filename}`);
        if (videoRef.current) {
          videoRef.current.load();
          videoRef.current
            .play()
            .catch((e) => console.error("Oynatma hatası:", e));
        }
        setIsPlaying(true);
      });

      socket.current.on("mute", () => {
        setMuted(true);
      });

      socket.current.on("unmute", () => {
        setMuted(false);
      });

      socket.current.on("volume-change", (volume) => {
        setVolume(volume);
      });

      socket.current.emit("get-videos");

      return () => {
        setSocketStatus("disconnected");
        console.log("Uygulama kapanıyor, soket bağlantısı kesiliyor.");
        socket.current.disconnect();
      };
    } catch (error) {
      console.error("Socket bağlantı hatası:", error);
      setError("Socket bağlantısı kurulamadı: " + error.message);
    }
  }, [socketLoadingBarRef.current, loadingBarRef.current]);

  useEffect(() => {
    localStorage.setItem("username", username);
  }, [username]);

  useEffect(() => {
    const handleOnline = () => {
      setNetworkStatus(true);
      if (socket.current?.disconnected) {
        handleReconnect();
      }
    };

    const handleOffline = () => {
      setNetworkStatus(false);
      setError("İnternet bağlantısı kesildi");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleReconnect = useCallback(() => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      setError("Maksimum yeniden bağlanma denemesi aşıldı");
      return;
    }

    setIsReconnecting(true);
    setReconnectAttempts((prev) => prev + 1);

    try {
      if (socket.current) {
        socket.current.disconnect();
      }

      socket.current = io(url, {
        ...socketOptions,
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts - reconnectAttempts,
      });

      socket.current.on("connect", () => {
        setIsReconnecting(false);
        setReconnectAttempts(0);
        setError(null);
        if (username) {
          socket.current.emit("user-join", username);
        }
      });

      socket.current.on("connect_error", (error) => {
        console.error("Yeniden bağlanma hatası:", error);
        setIsReconnecting(false);
        if (reconnectAttempts < maxReconnectAttempts) {
          setTimeout(() => handleReconnect(), 2000);
        }
      });
    } catch (error) {
      console.error("Yeniden bağlanma hatası:", error);
      setIsReconnecting(false);
      setError("Yeniden bağlanma hatası: " + error.message);
    }
  }, [reconnectAttempts, username, maxReconnectAttempts]);

  const handleUsernameSubmit = useCallback((name) => {
    setUsername(name);
    socket.current.emit("user-join", name);
  }, []);

  const handleFileUploadSuccess = useCallback(
    (filename) => {
      const videoUrl = `${url}/videos/${filename}`;
      setUploadedVideo(videoUrl);
      socket.current.emit("select-video", filename);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
      }
    },
    [socket.current, url]
  );

  const handleSelectVideo = useCallback(
    (filename) => {
      const videoUrl = `${url}/videos/${filename}`;
      setUploadedVideo(videoUrl);
      socket.current.emit("select-video", filename);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
      }
    },
    [socket.current]
  );

  const handleVideoDelete = useCallback(
    (filename) => {
      setAvailableVideos((prev) => prev.filter((v) => v !== filename));
      if (uploadedVideo === `${url}/videos/${filename}`) setUploadedVideo(null);
    },
    [uploadedVideo]
  );

  const handlePlay = useCallback(() => {
    const currentTime = videoRef.current?.currentTime || 0;
    socket.current.emit("play", currentTime);
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.play().catch((e) => {
        console.warn("Oynatma hatası:", e);
      });
    }
  }, []);

  const handlePause = useCallback(() => {
    const currentTime = videoRef.current?.currentTime || 0;
    socket.current.emit("pause", currentTime);
    setIsPlaying(false);
    if (videoRef.current) videoRef.current.pause();
  }, []);

  const handleSeek = useCallback((time) => {
    socket.current.emit("seek", time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  const handleMute = useCallback(() => {
    socket.current.emit("mute");
  }, []);

  const handleUnmute = useCallback(() => {
    socket.current.emit("unmute");
  }, []);

  const handleVolumeChange = useCallback((volume) => {
    socket.current.emit("volume-change", volume);
  }, []);

  const requestVideoCall = useCallback(() => {
    if (otherUserId) {
      socket.current.emit("call-user", {
        to: otherUserId,
        from: socket.current.id,
      });
      setShowVideoCall(true);
    } else {
      Swal.fire(
        "Uyarı",
        "Görüntülü arama yapmak için başka bir kullanıcının bağlanmasını bekleyin.",
        "warning"
      );
    }
  }, [otherUserId]);

  const closeSidebar = () => {
    setShowSidebar(false);
  };

  const toggleSidebar = () => {
    setShowSidebar((prev) => !prev);
  };

  const toggleVideoCall = () => {
    setShowVideoCall((prev) => !prev);
  };

  const handleExit = useCallback(() => {
    if (socket.current) {
      socket.current.disconnect();
    }
    localStorage.removeItem("username");
    setUsername("");
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-lg">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-red-500">
          <h2 className="text-2xl font-bold mb-4">Hata Oluştu</h2>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Yeniden Dene
          </button>
        </div>
      </div>
    );
  }

  if (!networkStatus) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <div className="bg-red-600 p-6 rounded-lg text-white text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">İnternet Bağlantısı Yok</h2>
          <p className="mb-4">
            Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.
          </p>
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mx-auto"></div>
        </div>
      </div>
    );
  }

  if (isReconnecting) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <div className="bg-blue-600 p-6 rounded-lg text-white text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Yeniden Bağlanılıyor</h2>
          <p className="mb-4">
            Deneme {reconnectAttempts}/{maxReconnectAttempts}
          </p>
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 font-sans text-white">
      <LoadingBar color="#f11946" ref={socketLoadingBarRef} shadow={false} />
      <LoadingBar color="#a0aec0" ref={loadingBarRef} shadow={false} />

      {!username ? (
        <div className="min-h-screen flex items-center justify-center">
          <UsernameInput onUsernameSubmit={handleUsernameSubmit} />
        </div>
      ) : (
        <div className="min-h-screen flex">
          {showSidebar && (
            <aside className="bg-gray-800 text-white w-72 p-6 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Video Listesi</h3>
                <button
                  onClick={handleExit}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <FontAwesomeIcon icon={faSignOutAlt} />
                </button>
              </div>
              <VideoList
                videos={availableVideos}
                onSelect={handleSelectVideo}
                onVideoDelete={handleVideoDelete}
                loading={videoListLoading}
                users={users}
              />
              <button
                onClick={() => setShowFileUpload(true)}
                className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                <FontAwesomeIcon icon={faFileUpload} className="mr-2" />
                Video Yükle
              </button>
            </aside>
          )}

          <main className="flex-grow bg-gray-900 flex flex-col">
            <header className="bg-gray-800 p-4 flex justify-between items-center shadow-lg">
              <div className="flex items-center space-x-4">
                <FontAwesomeIcon icon={faFilm} className="text-blue-500" />
                <span className="text-xl font-bold">WatchTogether</span>
              </div>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <FontAwesomeIcon icon={faUsers} className="text-green-500" />
                  <span>{userCount}</span>
                </div>
                <span className="text-gray-300">{username}</span>
                <button
                  onClick={handleExit}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Çıkış
                </button>
              </div>
            </header>

            <div className="flex-grow flex justify-center items-center relative p-6">
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
                socket={socket.current}
                isAudioCallEnabled={isAudioCallEnabled}
                otherUserId={otherUserId}
                requestVideoCall={requestVideoCall}
              />
              {showFileUpload && (
                <FileUpload
                  url={url}
                  onClose={() => setShowFileUpload(false)}
                  onUploadSuccess={handleFileUploadSuccess}
                  loadingBarRef={loadingBarRef}
                  socket={socket.current}
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
