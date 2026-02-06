//https://nostalgic-css.github.io/NES.css/#
//https://fonts.google.com/selection/embed
//////
// Button Toggles
document.querySelectorAll(".nes-btn").forEach((button) => {
  button.addEventListener("click", function () {
    if (
      this.classList.contains("is-primary") ||
      this.classList.contains("is-warning")
    ) {
      this.classList.toggle("is-primary");
      this.classList.toggle("is-warning");
      return;
    }

    if (
      this.classList.contains("is-success") ||
      this.classList.contains("is-error")
    ) {
      this.classList.toggle("is-success");
      this.classList.toggle("is-error");
    }
  });
});

// Badge Toggles
document.querySelectorAll(".nes-badge").forEach((badge) => {
  badge.addEventListener("click", function () {
    const badgeLabel = this.querySelector("span");
    if (!badgeLabel) return;

    if (
      badgeLabel.classList.contains("is-primary") ||
      badgeLabel.classList.contains("is-warning")
    ) {
      badgeLabel.classList.toggle("is-primary");
      badgeLabel.classList.toggle("is-warning");
      return;
    }

    if (
      badgeLabel.classList.contains("is-success") ||
      badgeLabel.classList.contains("is-error")
    ) {
      badgeLabel.classList.toggle("is-success");
      badgeLabel.classList.toggle("is-error");
    }
  });
});
