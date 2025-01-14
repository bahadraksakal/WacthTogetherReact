// components/UsernameInput.jsx
import React, { useState } from "react";
import backgroundImage from "../assets/myLove.jpg";

function UsernameInput({ onUsernameSubmit }) {
  const [username, setUsername] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      onUsernameSubmit(username);
    }
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center flex items-center justify-center"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50"></div>
      <div className="relative z-10 bg-white p-10 rounded-[1.5rem] shadow-2xl w-full max-w-md">
        <h2 className="text-3xl font-extrabold mb-6 text-center text-gray-800">
          A & Watch Together & B
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-6 flex flex-col items-center">
            <label
              htmlFor="username"
              className="block text-gray-700 text-lg font-semibold mb-2 text-left"
            >
              Kullanıcı Adı
            </label>
            <input
              type="text"
              id="username"
              className="shadow appearance-none border rounded-[1.5rem] py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline text-base w-3/4"
              placeholder="Kullanıcı adınızı girin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="flex items-center justify-center">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-800 text-white font-bold py-3 px-6 rounded-[1.5rem] text-lg transition duration-300 focus:outline-none focus:shadow-outline"
            >
              Katıl
            </button>
          </div>
        </form>
        <footer className="text-center mt-8 text-gray-500 text-sm">
          <p>Created by Bahox</p>
          <p>Yazılım Geliştirme Uzmanı Ahmet Bahadır Aksakal</p>
          <p>Tüm hakları saklıdır.</p>
        </footer>
      </div>
    </div>
  );
}

export default UsernameInput;
