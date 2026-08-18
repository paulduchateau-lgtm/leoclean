/* Rien n'est envoyé : la page bascule sur son accusé de réception. */
document.getElementById("form").addEventListener("submit", (e) => {
  e.preventDefault();
  document.querySelector(".login").classList.add("is-sent");
  window.scrollTo({ top: 0 });
});
