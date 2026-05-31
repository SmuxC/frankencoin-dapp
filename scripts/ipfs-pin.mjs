// Pin ./out to IPFS via Pinata, print the directory CID and the ENS contenthash.
// JWT is read from a file OUTSIDE the repo so it never lands in git or shell history.
//
//   printf '%s' 'YOUR_JWT' > /home/alen/dev/.pinata.jwt
//   node scripts/ipfs-pin.mjs
import fs from "node:fs";
import path from "node:path";
import { CID } from "multiformats/cid";

const JWT_FILE = process.env.PINATA_JWT_FILE || "/home/alen/dev/.pinata.jwt";
const DIR = path.resolve("out");
const ROOT = "out"; // wrapping directory name Pinata reconstructs

const jwt = fs.readFileSync(JWT_FILE, "utf8").trim();
if (!jwt) throw new Error(`Empty JWT in ${JWT_FILE}`);
if (!fs.existsSync(path.join(DIR, "index.html"))) throw new Error(`No build at ${DIR} — run yarn build first`);

function walk(dir) {
	const out = [];
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, e.name);
		if (e.isDirectory()) out.push(...walk(full));
		else if (e.isFile()) out.push(full);
	}
	return out;
}

const files = walk(DIR);
console.log(`Building multipart for ${files.length} files...`);

const form = new FormData();
for (const f of files) {
	const rel = path.relative(DIR, f).split(path.sep).join("/");
	const buf = fs.readFileSync(f);
	form.append("file", new Blob([buf]), `${ROOT}/${rel}`);
}
form.append("pinataMetadata", JSON.stringify({ name: "frankencoin-dapp" }));
form.append("pinataOptions", JSON.stringify({ cidVersion: 1, wrapWithDirectory: false }));

console.log("Uploading to Pinata (this can take a minute)...");
const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
	method: "POST",
	headers: { Authorization: `Bearer ${jwt}` },
	body: form,
});

const text = await res.text();
if (!res.ok) throw new Error(`Pinata ${res.status}: ${text}`);
const { IpfsHash } = JSON.parse(text);

const cidV1 = CID.parse(IpfsHash).toV1().toString(); // base32
console.log("\n=== PINNED ===");
console.log("CID (v1)        :", cidV1);
console.log("ENS contenthash :", `ipfs://${cidV1}`);
console.log("Preview         :", `https://${cidV1}.ipfs.dweb.link/`);
console.log("eth.limo (after ENS set): https://frankencoin.velebit.eth.limo/");
