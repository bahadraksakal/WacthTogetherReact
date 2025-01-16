// components/VideoList.jsx
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";

function VideoList({ videos, onSelect, onDelete }) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Mevcut Videolar</h3>
      <ul className="space-y-2">
        {videos &&
          videos.map((video, index) => (
            <li
              key={index}
              className="flex items-center justify-between cursor-pointer hover:bg-gray-100 p-2 rounded"
              style={{ borderRadius: "1.5rem" }}
            >
              <span
                onClick={() => onSelect(video)}
                className="block w-full truncate hover:underline"
              >
                {video}
              </span>
              <button
                onClick={() => onDelete(video)}
                className="text-red-500 hover:text-red-700 focus:outline-none"
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}

export default VideoList;
