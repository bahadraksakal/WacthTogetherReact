// components/FileUpload.jsx
import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload } from "@fortawesome/free-solid-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";
import { url } from "../utils";
import Swal from "sweetalert2";
import { ClipLoader } from "react-spinners";

library.add(faUpload);

function FileUpload({ onUploadSuccess, disabled, socket, onClose }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [progress, setProgress] = useState(0);
  const [remaining, setRemaining] = useState(100);
  const [speed, setSpeed] = useState(0);
  const [uploadStartTime, setUploadStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    let intervalId;
    if (uploading && uploadStartTime) {
      intervalId = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - uploadStartTime) / 1000);
        setElapsedTime(elapsed);
      }, 1000); // Her saniyede bir güncelle
    } else {
      clearInterval(intervalId);
    }
    return () => {
      clearInterval(intervalId);
    };
  }, [uploading, uploadStartTime]);

  useEffect(() => {
    socket.on("upload-progress", (data) => {
      setProgress(data.progress);
      setRemaining(data.remaining);
      setSpeed(data.speed);
    });
    return () => {
      socket.off("upload-progress");
    };
  }, []);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(sec).padStart(
      2,
      "0",
    )}`;
  };

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setErrorMessage("");
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      Swal.fire("Uyarı!", "Lütfen bir dosya seçin.", "warning");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("video", selectedFile);

    try {
      const response = await fetch(`${url}/upload`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        onUploadSuccess(data.filename);
        setSelectedFile(null);
        Swal.fire("Başarılı!", "Dosya başarıyla yüklendi!", "success");
      } else {
        const errorData = await response.json();
        Swal.fire(
          "Hata!",
          errorData.message || "Dosya yüklenirken bir hata oluştu.",
          "error",
        );
      }
    } catch (error) {
      console.error("Dosya yükleme hatası:", error);
      Swal.fire("Hata!", "Dosya yüklenirken bir hata oluştu.", "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded-lg shadow-lg relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-600 hover:text-gray-900"
        >
          X
        </button>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <input
              type="file"
              id="videoUpload"
              accept=".mp4,.avi,.mkv"
              onChange={handleFileChange}
              className="hidden"
              disabled={disabled || uploading}
            />
            <button
              type="button"
              className={`bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
                disabled || uploading ? "opacity-50 cursor-not-allowed" : ""
              }`}
              onClick={() => document.getElementById("videoUpload").click()}
              disabled={disabled || uploading}
              style={{ borderRadius: "1.5rem" }}
            >
              <FontAwesomeIcon icon={faUpload} className="mr-2" />
              {uploading || disabled ? (
                <ClipLoader color="#ffffff" size={20} />
              ) : (
                "Video Yükle"
              )}
            </button>
            {errorMessage && (
              <p className="text-red-500 text-sm mt-1">{errorMessage}</p>
            )}
            {(selectedFile || disabled) && (
              <button
                type="button"
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ml-2"
                onClick={handleSubmit}
                disabled={disabled || uploading}
                style={{ borderRadius: "1.5rem" }}
              >
                {uploading || disabled ? "Yükleniyor..." : "Yüklemeyi Onayla"}
              </button>
            )}
          </div>
          {uploading && (
            <div className="flex items-center space-x-2 py-2 px-4">
              <div className="w-20 h-2 bg-gray-300 rounded-full relative overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
                <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-gray-800 text-xs font-semibold">
                  {progress}%
                </span>
              </div>
              <span className="text-sm font-semibold text-gray-500">
                {speed} kb/s
              </span>
            </div>
          )}
          <div className="flex items-center space-x-2 py-2 px-4 ">
            {uploading && (
              <span className="text-sm font-semibold text-gray-500">
                Kalan: {remaining}%
              </span>
            )}
            {uploading && (
              <span className="text-sm font-semibold text-gray-500">
                {formatTime(elapsedTime)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default FileUpload;
