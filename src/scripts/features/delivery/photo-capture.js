import { PHOTO_RULES } from '../../config/constants.js';
import { byId } from '../../utils/dom.js';
import { formatDateTimeWithSeconds } from '../../utils/date.js';

/**
 * Captures the employee's photo for a delivery: from the camera, or from a
 * picture chosen on the device. The picture is stamped with date and time.
 */
let photoDataUrl = '';
let cameraStream = null;

export const getPhotoDataUrl = () => photoDataUrl;
const showPhotoMessage = (text) => { byId('photo-message').textContent = text; };

/** Shows only the controls that make sense for the current state. */
function updatePhotoControls() {
  const isCameraOn = Boolean(cameraStream);
  const hasPhoto = Boolean(photoDataUrl);
  byId('photo-video').hidden = !isCameraOn;
  byId('photo-preview').hidden = !hasPhoto || isCameraOn;
  byId('photo-placeholder').hidden = isCameraOn || hasPhoto;
  byId('photo-snap-button').hidden = !isCameraOn;
  byId('photo-open-camera-button').hidden = isCameraOn || hasPhoto;
  byId('photo-retake-button').hidden = !hasPhoto || isCameraOn;
  byId('photo-device-button').hidden = isCameraOn;
}

export function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  byId('photo-video').srcObject = null;
}

/** Clears the photo; optionally reopens the camera to take another one. */
export function resetPhoto({ reopenCamera = false } = {}) {
  stopCamera();
  photoDataUrl = '';
  byId('photo-preview').removeAttribute('src');
  showPhotoMessage('');
  updatePhotoControls();
  if (reopenCamera) openCamera();
}

export function refreshPhotoControls() {
  stopCamera();
  updatePhotoControls();
}

export async function openCamera() {
  showPhotoMessage('');
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
    showPhotoMessage('Este navegador não abre a câmera aqui. Use "Foto pelo aparelho".');
    return;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
      audio: false,
    });
    const video = byId('photo-video');
    video.srcObject = cameraStream;
    try {
      await video.play();
    } catch (error) {
      // Autoplay may be blocked; the stream is still attached.
    }
  } catch (error) {
    cameraStream = null;
    showPhotoMessage('Não consegui abrir a câmera (permissão negada ou indisponível neste ambiente). Use "Foto pelo aparelho".');
  }
  updatePhotoControls();
}

/** Scales the picture down and prints the current date and time on a dark bar. */
function stampPhoto(source, width, height) {
  const scale = Math.min(1, PHOTO_RULES.maximumWidth / width);
  const canvasWidth = Math.round(width * scale);
  const canvasHeight = Math.round(height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const context = canvas.getContext('2d');
  context.drawImage(source, 0, 0, canvasWidth, canvasHeight);

  const fontSize = Math.max(14, Math.round(canvasWidth / 24));
  const barHeight = fontSize + 14;
  context.font = `bold ${fontSize}px Arial,sans-serif`;
  context.fillStyle = 'rgba(0,0,0,.6)';
  context.fillRect(0, canvasHeight - barHeight, canvasWidth, barHeight);
  context.fillStyle = '#fff';
  context.textBaseline = 'middle';
  context.textAlign = 'right';
  context.fillText(formatDateTimeWithSeconds(new Date()), canvasWidth - 10, canvasHeight - barHeight / 2);
  return canvas.toDataURL('image/jpeg', PHOTO_RULES.jpegQuality);
}

export function takePhoto() {
  const video = byId('photo-video');
  if (!video.videoWidth) {
    showPhotoMessage('Aguarde a câmera carregar e tente de novo.');
    return;
  }
  photoDataUrl = stampPhoto(video, video.videoWidth, video.videoHeight);
  byId('photo-preview').src = photoDataUrl;
  stopCamera();
  updatePhotoControls();
}

function useChosenPhotoFile(file) {
  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  image.onload = () => {
    photoDataUrl = stampPhoto(image, image.naturalWidth, image.naturalHeight);
    byId('photo-preview').src = photoDataUrl;
    URL.revokeObjectURL(objectUrl);
    stopCamera();
    updatePhotoControls();
    showPhotoMessage('');
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    showPhotoMessage('Não consegui ler essa imagem.');
  };
  image.src = objectUrl;
}

export function bindPhotoFileInput() {
  byId('photo-file-input').addEventListener('change', (event) => {
    const [file] = event.target.files;
    event.target.value = '';
    if (file) useChosenPhotoFile(file);
  });
}

export const chooseDevicePhoto = () => byId('photo-file-input').click();
