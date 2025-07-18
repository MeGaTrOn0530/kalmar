"use client" // Bu komponent faqat mijoz tomonida ishlaydi

import { useRef, useEffect } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import TWEEN from "tween"

export default function GlassBridgeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const startButtonRef = useRef<HTMLButtonElement>(null)
  const resetButtonRef = useRef<HTMLButtonElement>(null)
  const gameStatusRef = useRef<HTMLDivElement>(null)
  const gameTitleRef = useRef<HTMLHeadingElement>(null)
  const instructionsRef = useRef<HTMLParagraphElement>(null)
  const initialSafeSidesRef = useRef<("left" | "right")[] | null>(null) // Stores the initial random sequence
  const isFirstGameStartRef = useRef(true) // Tracks if it's the very first game start

  useEffect(() => {
    // Global o'zgaruvchilar, initGame funksiyasida ishga tushiriladi
    let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, controls: OrbitControls
    let player: THREE.Mesh // Player endi to'q ko'k to'rtburchak bo'ladi

    // O'yin holati
    let currentLevel = 0
    const totalLevels = 10 // Jami 10 juft oyna
    let gameStarted = false
    let gameOver = false
    const glassPanels: { left: THREE.Mesh; right: THREE.Mesh; safeSide: "left" | "right" }[] = []
    const environmentMeshes: THREE.Mesh[] = [] // Yangi qo'shilgan platformalar uchun massiv

    // Raycaster va sichqoncha bosishini aniqlash uchun
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    let isProcessingClick = false // Bir vaqtda faqat bitta bosishni qayta ishlash uchun

    // Panellar orasidagi masofa va boshlang'ich Z koordinatasi
    const panelSpacing = 4
    const bridgeStart_Z = 0 // Birinchi shisha panelning Z koordinatasini 0 ga o'rnatdik
    const centralPlatformWidth = 7
    const sidePlatformWidth = 5

    // Yangi platformalar uchun buferlar
    const startPlatformLength = 6 // Boshlang'ich platforma uzunligi
    const endPlatformLength = 6 // Tugash platforma uzunligi
    const actualStartPlatformLength = 6 // Boshlang'ich platforma uzunligi

    // --- Funksiya ta'riflari ---

    function createPlayer() {
      const geometry = new THREE.BoxGeometry(0.8, 1.8, 0.8) // Inson shakliga yaqinroq
      const material = new THREE.MeshStandardMaterial({ color: 0x800080 }) // Binafsha rang (rasmdagi kabi)
      const playerMesh = new THREE.Mesh(geometry, material)
      playerMesh.position.set(0, 0.5, 0) // Boshlang'ich pozitsiya resetGame da belgilanadi
      return playerMesh
    }

    function createGlassPanel(x: number, z: number, isSafe = false) {
      const geometry = new THREE.BoxGeometry(3, 0.1, 3) // Yassi shisha panel
      const material = new THREE.MeshStandardMaterial({
        color: 0xFF8080, // Ochiq ko'k rang (shisha uchun)
        transparent: true,
        opacity: 0.2, // Shisha effekti uchun shaffoflikni oshirdik (0.7 dan 0.2 ga)
        roughness: 0.1, // Yaltiroqroq
        metalness: 0.5, // Metallik effekt
      })
      const panel = new THREE.Mesh(geometry, material)
      panel.position.set(x, 0.05, z) // Yashil platforma ustida joylashadi
      panel.userData.isSafe = isSafe // Panelning xususiyatini saqlash
      panel.userData.isBroken = false // Panelning sinmaganligini belgilash
      return panel
    }

    function createBridge(predefinedSafeSides?: ("left" | "right")[]) {
      console.log("Ko'prik yaratilmoqda...")
      // Oldingi panellarni va atrof-muhit meshlarini o'chirish
      glassPanels.forEach((pair) => {
        if (pair.left) scene.remove(pair.left)
        if (pair.right) scene.remove(pair.right)
      })
      environmentMeshes.forEach((mesh) => scene.remove(mesh))
      glassPanels.length = 0
      environmentMeshes.length = 0

      // Shisha panellarning Z diapazoni
      const firstGlassPanelCenterZ = bridgeStart_Z
      const lastGlassPanelCenterZ = bridgeStart_Z - (totalLevels - 1) * panelSpacing

      // Boshlang'ich platforma
      const startPlatformBackEdgeZ = firstGlassPanelCenterZ + panelSpacing / 2 // Birinchi shisha panelning oldingi chetiga moslash
      const startPlatformFrontEdgeZ = startPlatformBackEdgeZ + startPlatformLength
      const startPlatformCenterZ = (startPlatformBackEdgeZ + startPlatformFrontEdgeZ) / 2
      const startPlatform = new THREE.Mesh(
        new THREE.BoxGeometry(centralPlatformWidth, 0.8, actualStartPlatformLength), // Balandligini oshirdik
        new THREE.MeshStandardMaterial({
          color: 0x444444, // To'q kulrang
          roughness: 0.8, // Qo'polroq
          metalness: 0.1, // Metallik emas
        }),
      )
      startPlatform.position.set(0, -0.4, startPlatformCenterZ) // Y pozitsiyasini mosladik
      scene.add(startPlatform)
      environmentMeshes.push(startPlatform)

      // Tugash platformasi
      const endPlatformFrontEdgeZ = lastGlassPanelCenterZ - panelSpacing / 2 // Oxirgi shisha panelning orqa chetiga moslash
      const endPlatformBackEdgeZ = endPlatformFrontEdgeZ - endPlatformLength
      const endPlatformCenterZ = (endPlatformFrontEdgeZ + endPlatformBackEdgeZ) / 2
      const endPlatform = new THREE.Mesh(
        new THREE.BoxGeometry(centralPlatformWidth, 0.8, endPlatformLength), // Balandligini oshirdik
        new THREE.MeshStandardMaterial({
          color: 0x444444, // To'q kulrang
          roughness: 0.8,
          metalness: 0.1,
        }),
      )
      endPlatform.position.set(0, -0.4, endPlatformCenterZ) // Y pozitsiyasini mosladik
      scene.add(endPlatform)
      environmentMeshes.push(endPlatform)

      // Yashil yon platformalarning umumiy uzunligi va markazi
      const greenPlatformFrontZ = startPlatformFrontEdgeZ
      const greenPlatformBackZ = endPlatformBackEdgeZ
      const greenPlatformDepth = greenPlatformFrontZ - greenPlatformBackZ
      const greenPlatformCenterZ = (greenPlatformFrontZ + greenPlatformBackZ) / 2

      // Chap yon platforma
      const leftSidePlatformGeometry = new THREE.BoxGeometry(sidePlatformWidth, 2.0, greenPlatformDepth) // Balandligini oshirdik
      const leftSidePlatformMaterial = new THREE.MeshStandardMaterial({
        color: 0x228b22, // O'rmon yashili
        roughness: 0.9,
        metalness: 0.0,
      })
      const leftSidePlatform = new THREE.Mesh(leftSidePlatformGeometry, leftSidePlatformMaterial)
      leftSidePlatform.position.set(-centralPlatformWidth / 2 - sidePlatformWidth / 2 - 0.5, -1.0, greenPlatformCenterZ) // Y pozitsiyasini mosladik
      scene.add(leftSidePlatform)
      environmentMeshes.push(leftSidePlatform)

      // O'ng yon platforma
      const rightSidePlatformGeometry = new THREE.BoxGeometry(sidePlatformWidth, 2.0, greenPlatformDepth) // Balandligini oshirdik
      const rightSidePlatformMaterial = new THREE.MeshStandardMaterial({
        color: 0x228b22, // O'rmon yashili
        roughness: 0.9,
        metalness: 0.0,
      })
      const rightSidePlatform = new THREE.Mesh(rightSidePlatformGeometry, rightSidePlatformMaterial)
      rightSidePlatform.position.set(centralPlatformWidth / 2 + sidePlatformWidth / 2 + 0.5, -1.0, greenPlatformCenterZ) // Y pozitsiyasini mosladik
      scene.add(rightSidePlatform)
      environmentMeshes.push(rightSidePlatform)

      const generatedSafeSides: ("left" | "right")[] = [] // To store the sequence

      // 10 juft oynani yaratish
      for (let i = 0; i < totalLevels; i++) {
        const zPos = bridgeStart_Z - i * panelSpacing // Panellar -4, -8, ... da joylashadi
        const safeSide = predefinedSafeSides ? predefinedSafeSides[i] : Math.random() < 0.5 ? "left" : "right" // Use predefined or generate random

        const leftPanel = createGlassPanel(-2, zPos, safeSide === "left")
        const rightPanel = createGlassPanel(2, zPos, safeSide === "right")

        scene.add(leftPanel)
        scene.add(rightPanel)

        glassPanels.push({
          left: leftPanel,
          right: rightPanel,
          safeSide: safeSide,
        })
        generatedSafeSides.push(safeSide) // Store the safe side for this level
        console.log(
          `Daraja ${i}: Chap panel (x: -2, z: ${zPos}, xavfsiz: ${safeSide === "left"}), O'ng panel (x: 2, z: ${zPos}, xavfsiz: ${safeSide === "right"})`,
        )
      }
      console.log("Ko'prik yaratish tugadi.")
      return generatedSafeSides // Return the generated/used safe sides
    }

    // Shishani sindirish animatsiyasi
    function breakGlass(panel: THREE.Mesh, callback?: () => void) {
      console.log("breakGlass chaqirildi. Panel:", panel.uuid)
      if (panel.userData.isBroken) {
        console.log("Panel allaqachon singan.")
        return
      }

      panel.userData.isBroken = true
      // Shishani asta-sekin yo'q qilish
      new TWEEN.Tween(panel.material)
        .to({ opacity: 0 }, 500)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onComplete(() => {
          scene.remove(panel) // Sahndan olib tashlash
          console.log("Panel sahnadan olib tashlandi.")
          if (callback) callback() // Callbackni chaqirish
        })
        .start()

      // Shishani pastga tushirish (qo'shimcha effekt)
      new TWEEN.Tween(panel.position).to({ y: -10 }, 1000).easing(TWEEN.Easing.Quadratic.In).start()
    }

    // O'yinni tugatish
    function endGame(win: boolean) {
      console.log("endGame chaqirildi. G'alaba:", win)
      gameOver = true
      gameStarted = false
      player.visible = false // O'yinchini yashirish

      overlayRef.current?.classList.remove("hidden") // Overlayni ko'rsatish
      gameTitleRef.current?.classList.add("hidden") // Sarlavhani yashirish
      instructionsRef.current?.classList.add("hidden") // Yo'riqnomani yashirish
      startButtonRef.current?.classList.add("hidden") // Boshlash tugmasini yashirish
      resetButtonRef.current?.classList.add("hidden") // Qayta boshlash tugmasini yashirish (har doim yashirin)
      gameStatusRef.current?.classList.remove("hidden") // Holat xabarini ko'rsatish

      if (win) {
        if (gameStatusRef.current) {
          gameStatusRef.current.textContent = "TABRIKLAYMIZ! Siz ko'prikdan o'tdingiz!"
          gameStatusRef.current.classList.add("win")
          gameStatusRef.current.classList.remove("lose")
        }
      } else {
        if (gameStatusRef.current) {
          gameStatusRef.current.textContent = "O'yin tugadi! Noto'g'ri shishaga sakradingiz."
          gameStatusRef.current.classList.add("lose")
          gameStatusRef.current.classList.remove("win")
        }
      }
    }

    // Animatsiya sikli
    function animate() {
      requestAnimationFrame(animate) // Har doim keyingi kadrni so'rash

      controls.update() // Orbit boshqaruvlarini yangilash
      TWEEN.update() // Tween animatsiyalarini yangilash

      renderer.render(scene, camera)
    }

    // Oyna o'lchami o'zgarganda
    function onWindowResize() {
      console.log("Oyna o'lchami o'zgardi.")
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    // Pointer down event handler for interaction
    function onPointerDown(event: PointerEvent) {
      console.log("onPointerDown triggered!") // Debugging uchun qo'shildi
      event.preventDefault() // Brauzerning standart harakatlarini oldini olish
      event.stopPropagation() // Hodisaning yuqoriga tarqalishini to'xtatish

      if (!gameStarted || gameOver || isProcessingClick) {
        console.log("O'yin boshlanmagan, tugagan yoki bosish qayta ishlanmoqda. E'tiborsiz qoldirildi.")
        return
      }

      // Sichqoncha koordinatalarini normallashtirish (-1 dan +1 gacha)
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

      raycaster.setFromCamera(mouse, camera)

      // Singan bo'lmagan barcha shisha panellarni olish
      const interactivePanels = glassPanels
        .flatMap((pair) => [pair.left, pair.right])
        .filter((panel) => !panel.userData.isBroken)

      const intersects = raycaster.intersectObjects(interactivePanels)

      if (intersects.length > 0) {
        const clickedPanel = intersects[0].object as THREE.Mesh
        // Bosilgan obyekt haqiqatan ham shisha panel ekanligiga ishonch hosil qiling
        if (clickedPanel.userData && typeof clickedPanel.userData.isSafe !== "undefined") {
          // Bosilgan panel joriy darajaga tegishli ekanligini tekshirish
          const expectedZ = bridgeStart_Z - currentLevel * panelSpacing
          // Suzuvchi nuqta taqqoslashlari uchun kichik tolerantlikka ruxsat berish
          if (Math.abs(clickedPanel.position.z - expectedZ) > 0.1) {
            console.log("Noto'g'ri darajadagi panelga bosildi.")
            return // Boshqa darajadagi panellardagi bosishlarni e'tiborsiz qoldirish
          }

          isProcessingClick = true // Bosishni qayta ishlashni boshlash

          if (clickedPanel.userData.isSafe) {
            console.log("Xavfsiz panelga bosildi!")
            // O'yinchini tanlangan panelga siljitish
            new TWEEN.Tween(player.position)
              .to({ x: clickedPanel.position.x, y: 0.5, z: clickedPanel.position.z }, 500)
              .easing(TWEEN.Easing.Quadratic.Out)
              .onUpdate(() => {
                // Kamerani o'yinchi bilan birga siljitish
                controls.target.set(player.position.x, player.position.y, player.position.z)
                controls.update()
              })
              .onComplete(() => {
                currentLevel++
                if (gameStatusRef.current) {
                  gameStatusRef.current.textContent = `Daraja: ${currentLevel} / ${totalLevels}`
                }
                console.log(`Keyingi darajaga o'tildi: ${currentLevel}`)

                if (currentLevel === totalLevels) {
                  endGame(true)
                }
                isProcessingClick = false // Bosishni qayta ishlash tugadi
              })
              .start()
          } else {
            console.log("Xavfli panelga bosildi!")
            breakGlass(clickedPanel, () => {
              endGame(false) // O'yin tugadi xabarini ko'rsatish
              setTimeout(() => {
                resetGame(true) // O'yin holatini avtomatik qayta boshlash uchun o'rnatish
                startGame() // O'yinni avtomatik boshlash
                isProcessingClick = false // O'yin qayta o'rnatilgandan keyin flagni qayta o'rnatish
              }, 2000) // 2 soniya kutish
            })
          }
        }
      }
    }

    // --- O'yinni ishga tushirish ---
    function initGame() {
      console.log("initGame chaqirildi. O'yinni ishga tushirish...")
      // UI elementlarini olish
      const gameCanvas = canvasRef.current

      // Elementlar topilganligini tekshirish
      if (!gameCanvas || !overlayRef.current || !startButtonRef.current) {
        console.error("Kerakli UI elementlaridan biri topilmadi. HTML ID'larini tekshiring.")
        return
      }

      // Three.js sozlamalari
      renderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true })
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.setClearColor(0x87ceeb) // Osmon rangi

      scene = new THREE.Scene()
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
      // Kameraning boshlang'ich pozitsiyasini sozlash (biroz burchakli ko'rinish uchun)
      camera.position.set(0, 15, 15) // Y va Z koordinatalarini o'zgartirdik

      // Yorug'lik sozlamalari
      const ambientLight = new THREE.AmbientLight(0xa0a0a0) // Atrof yorug'lik intensivligi oshirildi
      scene.add(ambientLight)

      const directionalLight1 = new THREE.DirectionalLight(0xffffff, 2.5) // Intensivlik oshirildi
      directionalLight1.position.set(0, 10, 5)
      scene.add(directionalLight1)

      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 2) // Ikkinchi yo'nalishli yorug'lik
      directionalLight2.position.set(0, 10, -5) // Qarama-qarshi tomondan yoritish
      scene.add(directionalLight2)

      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.25
      controls.screenSpacePanning = false
      controls.maxPolarAngle = Math.PI / 2 // Er ostiga tushmaslik

      player = createPlayer() // Player endi binafsha to'rtburchak
      scene.add(player)

      // Hodisa tinglovchilari
      setTimeout(() => {
        startButtonRef.current?.addEventListener("click", startGame) // 100ms kechikish bilan qo'shamiz
      }, 100)
      resetButtonRef.current?.addEventListener("click", resetGame)
      renderer.domElement.addEventListener("pointerdown", onPointerDown) // Yangi hodisa tinglovchisi
      window.addEventListener("resize", onWindowResize)

      // O'yinni boshlang'ich holatga keltirish va animatsiyani boshlash
      resetGame() // UI va ko'prikni sozlaydi, overlayni ko'rsatadi
      animate() // Animatsiya siklini boshlaydi
      console.log("O'yin ishga tushirildi va animatsiya boshlandi.")
    }

    function startGame() {
      console.log("startGame chaqirildi. O'yin boshlandi! (Actual start)") // Qo'shimcha log
      gameStarted = true
      gameOver = false
      overlayRef.current?.classList.add("hidden") // Overlayni yashirish
      player.visible = true // O'yinchini ko'rsatish
      if (gameStatusRef.current) {
        gameStatusRef.current.textContent = `Daraja: ${currentLevel} / ${totalLevels}` // O'yin boshlanganda darajani ko'rsatish
        gameStatusRef.current.classList.remove("hidden") // gameStatus ko'rinishini ta'minlash
      }
    }

    function resetGame(autoRestart = false) {
      // autoRestart parametrini qo'shdik
      console.log("resetGame chaqirildi. O'yin holati qayta o'rnatilmoqda...")
      // Oldingi panellarni va atrof-muhit meshlarini tozalash
      glassPanels.forEach((pair) => {
        if (pair.left) scene.remove(pair.left)
        if (pair.right) scene.remove(pair.right)
      })
      environmentMeshes.forEach((mesh) => scene.remove(mesh)) // Atrof-muhit meshlarini o'chirish
      glassPanels.length = 0
      environmentMeshes.length = 0

      currentLevel = 0
      // O'yinchini yangi boshlang'ich platformaning ustiga joylashtirish
      const startPlatformBackEdgeZ = bridgeStart_Z + panelSpacing / 2
      const initialPlayerZ = startPlatformBackEdgeZ + startPlatformLength / 2
      const initialPlayerX = 0 // Markazga joylashtiramiz
      player.position.set(initialPlayerX, 0.5, initialPlayerZ) // X, Y, Z koordinatalari
      player.visible = true // O'yinchini ko'rsatish
      console.log(`O'yinchi boshlang'ich pozitsiyaga o'rnatildi: x=${initialPlayerX}, y=0.5, z=${initialPlayerZ}`)

      // Kamerani o'yinchining boshlang'ich pozitsiyasiga qaratish va kuzatish
      camera.position.set(player.position.x, 15, player.position.z + 17) // Kameraning boshlang'ich X, Y, Z pozitsiyasi
      controls.target.set(player.position.x, player.position.y, initialPlayerZ)
      controls.update() // Target o'zgarganda boshqaruvlarni yangilash
      console.log("Kamera va boshqaruvlar boshlang'ich holatga o'rnatildi.")

      // UI elementlarini boshqarish
      if (!autoRestart) {
        // Agar avtomatik qayta boshlash bo'lmasa, boshlang'ich overlayni ko'rsatish
        overlayRef.current?.classList.remove("hidden")
        gameTitleRef.current?.classList.remove("hidden")
        instructionsRef.current?.classList.remove("hidden")
        startButtonRef.current?.classList.remove("hidden")
        resetButtonRef.current?.classList.add("hidden") // Qayta boshlash tugmasini yashirish
      } else {
        // Agar avtomatik qayta boshlash bo'lsa, overlayni yashirish
        overlayRef.current?.classList.add("hidden")
        gameTitleRef.current?.classList.add("hidden")
        instructionsRef.current?.classList.add("hidden")
        startButtonRef.current?.classList.add("hidden")
        resetButtonRef.current?.classList.add("hidden")
      }

      gameStatusRef.current?.classList.add("hidden") // Holat xabarini yashirish
      gameStatusRef.current?.classList.remove("win", "lose") // G'alaba/mag'lubiyat klasslarini olib tashlash
      console.log("UI elementlari qayta o'rnatildi.")

      // Determine if it's the first game start or a restart
      let safeSidesToUse: ("left" | "right")[]
      if (isFirstGameStartRef.current) {
        // First game start, generate new random sides and store them
        safeSidesToUse = createBridge()
        initialSafeSidesRef.current = safeSidesToUse
        isFirstGameStartRef.current = false // Set to false after the first start
        console.log("First game start: Generated new random bridge.")
      } else {
        // Restart, use the previously stored safe sides
        if (initialSafeSidesRef.current) {
          safeSidesToUse = createBridge(initialSafeSidesRef.current)
          console.log("Game restart: Recreated bridge with previous safe sides.")
        } else {
          // Fallback, should not happen if initialSafeSidesRef is properly set on first run
          safeSidesToUse = createBridge()
          console.warn("initialSafeSidesRef was null on restart, generating new random bridge.")
        }
      }

      // Kamerani o'yinchining boshlang'ich pozitsiyasiga qaratish
      controls.target.set(player.position.x, player.position.y, initialPlayerZ)
      controls.update() // Target o'zgarganda boshqaruvlarni yangilash
      console.log("resetGame tugadi.")
    }

    // Komponent yuklanganda initGame funksiyasini chaqirish
    initGame()

    // Tozalash funksiyasi
    return () => {
      // Hodisa tinglovchilarini olib tashlash
      startButtonRef.current?.removeEventListener("click", startGame)
      resetButtonRef.current?.removeEventListener("click", resetGame)
      renderer.domElement?.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("resize", onWindowResize)

      // Three.js obyektlarini yo'q qilish
      if (renderer) {
        renderer.dispose()
      }
      if (scene) {
        scene.traverse((object: THREE.Object3D) => {
          if (object instanceof THREE.Mesh) {
            // THREE.Mesh turini tekshirish
            object.geometry.dispose()
            if (object.material instanceof THREE.Material) {
              // THREE.Material turini tekshirish
              object.material.dispose()
            } else if (Array.isArray(object.material)) {
              object.material.forEach((material: THREE.Material) => material.dispose())
            }
          }
        })
      }
      if (controls) {
        controls.dispose()
      }
      TWEEN.removeAll() // Barcha faol tweenlarni tozalash
    }
  }, []) // Bo'sh bog'liqlik massivi bu effektning komponent yuklanganda bir marta ishlashini anglatadi

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <canvas id="gameCanvas" ref={canvasRef} className="block w-full h-full"></canvas>

      <div
        id="overlay"
        ref={overlayRef}
        className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center text-white text-center p-4"
      >
        <h1 id="game-title" ref={gameTitleRef} className="text-4xl font-bold mb-4">
          Shisha Ko'prik O'yini
        </h1>
        <p id="instructions" ref={instructionsRef} className="text-lg mb-8 max-w-md">
          Har bir juftlikda bitta xavfsiz va bitta xavfli shisha panel bor. Faqat xavfsiz panelga bosib keyingi darajaga
          o'ting. Xavfli panelga bossangiz, o'yin tugaydi!
        </p>
        <button
          id="startButton"
          ref={startButtonRef}
          className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white text-xl font-bold rounded-lg shadow-lg transition-colors duration-300"
        >
          O'yinni Boshlash
        </button>
        <p id="game-status" ref={gameStatusRef} className="text-2xl font-bold mt-8 hidden">
          Daraja: 0 / 10
        </p>
        <button
          id="resetButton"
          ref={resetButtonRef}
          className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold rounded-lg shadow-lg transition-colors duration-300 hidden"
        >
          Qayta Boshlash
        </button>
      </div>

      {/* style.css dagi global uslublar */}
      <style jsx global>{`
        body {
          margin: 0;
          overflow: hidden;
          font-family: "Arial", sans-serif;
          background-color: #1a1a1a;
          color: #eee;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
        }
        /* #game-container va canvas uslublari to'g'ridan-to'g'ri JSX da Tailwind orqali berilgan */
        /* #overlay uslublari to'g'ridan-to'g'ri JSX da Tailwind orqali berilgan */
        /* h1, p, button uslublari to'g'ridan-to'g'ri JSX da Tailwind orqali berilgan */
        
        .win {
          color: #4caf50; /* G'alaba uchun yashil */
        }
        .lose {
          color: #f44336; /* Mag'lubiyat uchun qizil */
        }
        .hidden {
          display: none !important;
        }
      `}</style>
    </div>
  )
}
