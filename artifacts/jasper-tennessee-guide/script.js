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
