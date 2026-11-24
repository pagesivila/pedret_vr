# WebXR / Three.js Pedret VR Application

A WebXR virtual reality application built with Three.js, `three-mesh-ui`, and Vite.

## 0. Prerequisites (Ubuntu)

* Install `curl` from the official `apt` repositories (not the `snap` version):
  ```bash
  sudo apt update && sudo apt install curl
  ```

* Install NVM ([Node Version Manager](https://github.com/nvm-sh/nvm)):
  ```bash
  curl -o- [https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh](https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh) | bash
  source ~/.bashrc
  nvm --version
  ```

* Install Node.js (LTS):
  ```bash
  nvm install --lts
  ```

* Verify installation:
  ```bash
  node -v
  npm -v
  ```

## 1. Clone the Project

```bash
git clone https://github.com/pagesivila/pedret_vr.git
```

## 2. Install Dependencies

Navigate into the project folder and install the core dependencies:
```bash
cd <your-project-folder>
npm install three
npm install three-mesh-ui
```

## 3. Install Dev Dependencies

```bash
npm install -D vite
npm install -D vite-plugin-restart
npm install -D vite-plugin-mkcert
```

## 4. Initialize the Project

```bash
npm init -y
```

## 5. Modify `package.json`

Update `package.json` to configure the project:
* Add `"private": true`
* Set `"type": "module"`
* Remove `"test"` from `"scripts"` and set the Vite scripts:

```json
{
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

## 6. Adding Static Assets

Place additional resources inside the `static/` folder (for example, `.ply`, `.nxz`, textures, etc.).

## 7. Running the Project

Start the development server:
```bash
npm run dev
```