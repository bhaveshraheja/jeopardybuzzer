const fs = require('fs');
const path = require('path');

const GAMES_DIR = path.join(__dirname, '..', 'games');

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function gameDir(slug) {
  return path.join(GAMES_DIR, slug);
}

function uniqueSlug(name) {
  const base = slugify(name);
  let slug;
  do {
    slug = `${base}-${Math.floor(100 + Math.random() * 900)}`;
  } while (fs.existsSync(gameDir(slug)));
  return slug;
}

function listGames() {
  if (!fs.existsSync(GAMES_DIR)) return [];
  return fs.readdirSync(GAMES_DIR)
    .filter((entry) => fs.existsSync(path.join(gameDir(entry), 'game.json')))
    .map((slug) => readGame(slug));
}

function readGame(slug) {
  const filePath = path.join(gameDir(slug), 'game.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function createGame({ name, categoryCount, questionCount }) {
  const slug = uniqueSlug(name);
  fs.mkdirSync(path.join(gameDir(slug), 'images'), { recursive: true });

  const categories = Array.from({ length: categoryCount }, (_, i) => ({
    name: `Category ${i + 1}`,
    questions: Array.from({ length: questionCount }, (_, j) => ({
      value: (j + 1) * 100,
      question: '',
      answer: '',
      image: null
    }))
  }));

  const game = { id: slug, name, createdAt: new Date().toISOString(), categories };
  writeGame(slug, game);
  return game;
}

function writeGame(slug, game) {
  const filePath = path.join(gameDir(slug), 'game.json');
  fs.writeFileSync(filePath, JSON.stringify(game, null, 2));
}

function saveImage(slug, filename, buffer) {
  const imagesDir = path.join(gameDir(slug), 'images');
  fs.mkdirSync(imagesDir, { recursive: true });
  fs.writeFileSync(path.join(imagesDir, filename), buffer);
  return `images/${filename}`;
}

module.exports = { slugify, uniqueSlug, listGames, readGame, createGame, writeGame, saveImage };
