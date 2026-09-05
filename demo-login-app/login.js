```CodeLanguage.JAVASCRIPT
// Fixed CSS - Login button positioning
.login-button {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  width: 90%;
  max-width: 400px;
  padding: 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

/* Mobile-specific adjustments */
@media (max-width: 768px) {
  .login-button {
    bottom: 15px;
    width: calc(100% - 30px);
    max-width: none;
    padding: 14px;
    font-size: 15px;
  }
}

/* Ensure button is always visible and clickable */
.login-button:active,
.login-button:focus {
  outline: none;
  transform: translateX(-50%) scale(0.98);
}

/* Add safe area support for devices with home indicators */
@supports (padding: max(0px)) {
  .login-button {
    bottom: max(15px, env(safe-area-inset-bottom));
  }
}
```