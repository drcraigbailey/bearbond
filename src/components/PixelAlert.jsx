import React from 'react';
import '../styles/BearBond.css';

export default function PixelAlert({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="pixel-alert-overlay">
      <div className="pixel-alert-box">
        <p className="pixel-alert-message">{message}</p>
        <button onClick={onClose} className="pixel-btn primary">
          OK
        </button>
      </div>
    </div>
  );
}