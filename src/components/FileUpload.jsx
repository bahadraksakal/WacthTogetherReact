// components/FileUpload.jsx
import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload } from "@fortawesome/free-solid-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";
import { url } from "../utils";
import Swal from "sweetalert2";

library.add(faUpload);

function FileUpload({ onUploadSuccess, disabled }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
          "error"
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
    <div className="space-y-2">
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
        {uploading ? "Yükleniyor..." : "Video Yükle"}
      </button>
      {errorMessage && (
        <p className="text-red-500 text-sm mt-1">{errorMessage}</p>
      )}
      {selectedFile && (
        <button
          type="button"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ml-2"
          onClick={handleSubmit}
          disabled={uploading}
          style={{ borderRadius: "1.5rem" }}
        >
          {uploading ? "Yükleniyor..." : "Yüklemeyi Onayla"}
        </button>
      )}
    </div>
  );
}

export default FileUpload;
