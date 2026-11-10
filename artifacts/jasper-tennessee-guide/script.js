// Keep the small interactions here so the HTML remains easy to follow.
const birdButton = document.querySelector("#bird-button");
const birdImage = document.querySelector("#bird-image");
const likeForm = document.querySelector("#like-form");
const likeInput = document.querySelector("#like-input");
const likeList = document.querySelector("#like-list");

// Restart the CSS animation on each mouse or keyboard activation.
birdButton.addEventListener("click", () => {
  birdImage.classList.remove("shake");
  // Reading the layout lets the browser replay the animation immediately.
  void birdImage.offsetWidth;
  birdImage.classList.add("shake");
});

birdImage.addEventListener("animationend", () => {
  birdImage.classList.remove("shake");
});

// Add notes only to this page's in-memory list; nothing is saved to the device.
likeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const note = likeInput.value.trim();

  if (!note) {
    likeInput.focus();
    return;
  }

  const emptyMessage = likeList.querySelector(".empty-note");
  if (emptyMessage) emptyMessage.remove();

  // textContent treats visitor input as text instead of interpreting HTML.
  const listItem = document.createElement("li");
  listItem.textContent = note;
  likeList.appendChild(listItem);

  likeInput.value = "";
  likeInput.focus();
});

// Shared dish photos are stored by the API, so the gallery survives restarts.
const dishUploadForm = document.querySelector("#dish-upload-form");
const dishTitleInput = document.querySelector("#dish-title");
const dishCaptionInput = document.querySelector("#dish-caption");
const dishImageInput = document.querySelector("#dish-image");
const dishUploadButton = document.querySelector("#dish-upload-button");
const dishUploadStatus = document.querySelector("#dish-upload-status");
const dishGalleryList = document.querySelector("#dish-gallery-list");
const dishGalleryCount = document.querySelector("#dish-gallery-count");
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_SIDE = 1280;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function setDishUploadStatus(message, state = "") {
  dishUploadStatus.textContent = message;
  dishUploadStatus.dataset.state = state;
}

function updateDishGalleryCount() {
  const count = dishGalleryList.querySelectorAll(".dish-gallery-card").length;
  dishGalleryCount.textContent = `${count} ${count === 1 ? "photo" : "photos"} shared`;
}

function showDishGalleryMessage(message) {
  const emptyItem = document.createElement("li");
  emptyItem.className = "dish-gallery-empty";
  emptyItem.textContent = message;
  dishGalleryList.replaceChildren(emptyItem);
}

function createDishPhotoCard(photo) {
  const card = document.createElement("li");
  card.className = "dish-gallery-card";

  const image = document.createElement("img");
  image.className = "dish-gallery-image";
  image.src = photo.imageUrl;
  image.alt = `Photo of ${photo.title}`;
  image.loading = "lazy";
  image.decoding = "async";

  const details = document.createElement("div");
  details.className = "dish-gallery-details";

  const title = document.createElement("h3");
  title.textContent = photo.title;
  details.appendChild(title);

  if (photo.caption) {
    const caption = document.createElement("p");
    caption.className = "dish-gallery-caption";
    caption.textContent = photo.caption;
    details.appendChild(caption);
  }

  const date = new Date(photo.createdAt);
  const dateLabel = document.createElement("time");
  dateLabel.className = "dish-gallery-date";
  if (!Number.isNaN(date.getTime())) {
    dateLabel.dateTime = date.toISOString();
    dateLabel.textContent = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } else {
    dateLabel.textContent = "Recently shared";
  }
  details.appendChild(dateLabel);

  card.append(image, details);
  return card;
}

async function loadDishPhotos() {
  dishGalleryCount.textContent = "Loading photos…";

  try {
    const response = await fetch("/api/dishes", {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error("The photo gallery could not be loaded.");
    }

    const photos = await response.json();
    if (!Array.isArray(photos)) {
      throw new Error("The photo gallery returned an unexpected response.");
    }

    if (photos.length === 0) {
      showDishGalleryMessage("No photos yet. Be the first to share a Jasper favorite.");
    } else {
      dishGalleryList.replaceChildren(...photos.map(createDishPhotoCard));
    }

    updateDishGalleryCount();
  } catch (error) {
    showDishGalleryMessage("The gallery is unavailable right now. Try refreshing the page.");
    dishGalleryCount.textContent = "Photos unavailable";
  }
}

function makeCanvasBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("This browser could not prepare the photo."));
        }
      },
      mimeType,
      quality,
    );
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("The photo could not be prepared for upload."));
      }
    });
    reader.addEventListener("error", () => {
      reject(new Error("The photo could not be read."));
    });
    reader.readAsDataURL(blob);
  });
}

async function resizePhotoToDataUrl(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("This browser could not prepare the photo.");
  }

  const qualityLevels = [0.86, 0.78, 0.7, 0.62, 0.56];
  let maxSide = MAX_IMAGE_SIDE;

  try {
    for (let attempt = 0; attempt < 9; attempt += 1) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.width = width;
      canvas.height = height;
      context.drawImage(bitmap, 0, 0, width, height);

      const quality = file.type === "image/png"
        ? undefined
        : qualityLevels[Math.min(attempt, qualityLevels.length - 1)];
      const blob = await makeCanvasBlob(canvas, file.type, quality);

      if (blob.size <= MAX_UPLOAD_BYTES && ACCEPTED_IMAGE_TYPES.has(blob.type)) {
        return await blobToDataUrl(blob);
      }

      // Smaller dimensions keep the result within the API's 3 MB limit.
      maxSide = Math.max(360, Math.floor(maxSide * 0.82));
    }
  } finally {
    bitmap.close();
  }

  throw new Error("This photo could not be reduced below 3 MB. Choose a smaller image.");
}

async function getUploadError(response) {
  try {
    const body = await response.json();
    if (typeof body.error === "string") {
      return body.error;
    }
  } catch (error) {
    // Use the generic message below when the server did not return JSON.
  }

  return `Upload failed (${response.status}). Please try again.`;
}

dishUploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setDishUploadStatus("");

  const file = dishImageInput.files[0];
  if (!file) {
    setDishUploadStatus("Choose a JPEG, PNG, or WebP photo first.", "error");
    dishImageInput.focus();
    return;
  }

  if (!ACCEPTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    setDishUploadStatus("GIFs and other formats are not supported. Choose JPEG, PNG, or WebP.", "error");
    dishImageInput.focus();
    return;
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    setDishUploadStatus("This photo is over 3 MB. Choose a smaller image.", "error");
    dishImageInput.focus();
    return;
  }

  const originalButtonContent = dishUploadButton.innerHTML;
  dishUploadButton.disabled = true;
  dishUploadButton.textContent = "Preparing photo…";
  dishUploadForm.setAttribute("aria-busy", "true");
  setDishUploadStatus("Resizing your photo before upload…");

  try {
    const image = await resizePhotoToDataUrl(file);
    const response = await fetch("/api/dishes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        title: dishTitleInput.value.trim(),
        caption: dishCaptionInput.value.trim(),
        image,
      }),
    });

    if (!response.ok) {
      throw new Error(await getUploadError(response));
    }

    const savedPhoto = await response.json();
    const emptyMessage = dishGalleryList.querySelector(".dish-gallery-empty");
    if (emptyMessage) emptyMessage.remove();
    dishGalleryList.prepend(createDishPhotoCard(savedPhoto));
    updateDishGalleryCount();
    dishUploadForm.reset();
    setDishUploadStatus("Your photo is now at the top of the gallery.", "success");
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "The photo could not be uploaded. Please try again.";
    setDishUploadStatus(message, "error");
  } finally {
    dishUploadButton.disabled = false;
    dishUploadButton.innerHTML = originalButtonContent;
    dishUploadForm.removeAttribute("aria-busy");
  }
});

loadDishPhotos();
