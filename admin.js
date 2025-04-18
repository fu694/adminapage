import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, getDocs,query, where, orderBy, limit, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

// ✅ 1. Initialize Firebase Configuration (Replace with Your Firebase Details)
const firebaseConfig = {
    apiKey: "AIzaSyBotf9wLzGYH54FVHV4EbmWEjzTDXn_IQI",
    authDomain: "oclock-8378b.firebaseapp.com",
    projectId: "oclock-8378b",
    storageBucket: "oclock-8378b.firebasestorage.app",
    messagingSenderId: "217669506746",
    appId: "1:217669506746:web:b5af90b413170603601483",
    measurementId: "G-TDG40NE9M2"
};

  
// ✅ 2. Initialize Firebase Services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ✅ 3. Admin Email (Replace with your actual admin email)
const ADMIN_EMAIL = "namafu694@gmail.com";

// ✅ 4. DOM Elements
const pendingImagesDiv = document.getElementById("pendingImages");
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const adminEmailDisplay = document.getElementById("adminEmail");

// =======================================================
// 👤 5. Authentication Handling
// =======================================================

//Handle user authentication state
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User logged in:", user.email);

        if (user.email === ADMIN_EMAIL) {
            document.getElementById("adminEmail").textContent = user.email;
            loadPendingImages();
            document.getElementById("loginButton").style.display = "none";
            document.getElementById("logoutButton").style.display = "block";
        } else {
            alert("Access denied! Only admin can view this page.");
            signOut(auth); // Logs out unauthorized users
            window.location.href = "index.html";
        }
    } else {
        console.log("No user is logged in.");
        document.getElementById("loginButton").style.display = "block";
        document.getElementById("logoutButton").style.display = "none";
    }
});

// 🔓 Google Login
document.getElementById("loginButton").addEventListener("click", async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        if (result.user.email !== ADMIN_EMAIL) {
            alert("You are not authorized to access this page.");
            await signOut(auth);
            window.location.href = "index.html";
        }
    } catch (error) {
        console.error("Login error:", error);
    }
});

// 🔓 Logout
document.getElementById("logoutButton").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
});

// 📥6. Load Pending Images
async function loadPendingImages() {
    console.log("Loading pending images...");
    document.getElementById("pendingImages").innerHTML = "";
    document.getElementById("approvedImages").innerHTML = "";

    const seenDocIds = new Set();
    const seenKeys = new Set();

    const numbersRef = collection(db, "numbers");
    const numbersSnapshot = await getDocs(numbersRef);
    console.log("Numbers Snapshot:", numbersSnapshot.docs); 

    for (const numberDoc of numbersSnapshot.docs) {
        console.log("Number Doc ID:", numberDoc.id);
        const numberId = numberDoc.id;
        const historyRef = collection(db, "numbers", numberId, "history");
        const q = query(historyRef, orderBy("timestamp", "desc"));

        const historySnapshot = await getDocs(q);
    

        console.log("History Snapshot:", historySnapshot);

        if (historySnapshot.empty) continue;
        for (const imageDoc of historySnapshot.docs) {
        const docId = imageDoc.id;

        const imageData = imageDoc.data();
        if (!imageData || !imageData.canvasData) continue;

        const key = imageData.canvasData + imageData.status;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        
        const container = document.createElement("div");
        container.className = "image-item";
        container.draggable = true;
        container.dataset.numberId = numberId;
        container.dataset.docId = imageDoc.id;
        container.dataset.status = imageData.status;

        container.innerHTML = `
            <img src="${imageData.canvasData}" alt="Image">
            <p>Number: ${imageData.number || "N/A"}</p>
            <p>Status: ${imageData.status}</p>
        `;

        container.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/plain", JSON.stringify({
                numberId,
                docId: imageDoc.id,
                status: imageData.status
            }));
        });

        const boxId = imageData.status === "approved" ? "approvedImages" : "pendingImages";
        document.getElementById(boxId).appendChild(container);
    }
}}


const displayImage = (docSnapshot) => {
    if (!docSnapshot.exists()) {
        console.warn("⚠️ Document does not exist:", docSnapshot.id);
        return null; 
    }

    const data = docSnapshot.data();
    if (!data) {
        console.warn("⚠️ No data found in document:", doc.id);
        return null;
    }

    const img = document.createElement('img');
    img.src = data.imageUrl ? data.imageUrl : "/images/default-number.png";  // Use imageUrl or fallback
    img.alt = "Uploaded Image";
    img.style.width = "100px";  

    return img;
};
["approvedBox", "deleteBox", "pendingBox"].forEach(boxId => {
    const box = document.getElementById(boxId);
    box.addEventListener("dragover", e => e.preventDefault());

    box.addEventListener("drop", async e => {
        e.preventDefault();
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        const { numberId, docId } = data;
        console.log(`📥 Drop on ${boxId}:`, data);

        const docRef = doc(db, "numbers", numberId, "history", docId);

        if (boxId === "deleteBox") {
            await deleteDoc(docRef);
            console.log(`🗑️ Deleted ${docId}`);
        } else if (boxId === "approvedBox") {
            await updateDoc(docRef, { status: "approved" });
            console.log(`✅ Approved ${docId}`);
        } else if (boxId === "pendingBox") {
            try {
                await updateDoc(docRef, { status: "pending" });
                console.log(`🔄 Moved back to pending: ${docId}`);
            } catch (error) {
                console.error("Error updating status to pending:", error);
            }
        }

        loadPendingImages(); // Refresh view
    });
});

