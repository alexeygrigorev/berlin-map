import "./hills-explorer.css";
import { createHillsExplorer } from "./hills-explorer.js";

createHillsExplorer({
  dataBase: "france/",
  title: "ГОРЫ И ХОЛМЫ ФРАНЦИИ",
  pickSubtitle: "выберите регион — кликните по карте",
});
