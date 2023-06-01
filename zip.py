import subprocess
import os
import zipfile
import shutil

def zipdir(path, ziph):
  # ziph is zipfile handle
  for root, dirs, files in os.walk(path):
    if "./node_modules" not in root[:14] and "./src" not in root[:6]:
      continue
    for file in files:
      if file in ["local.json", "test.js"]:
        continue
      ziph.write(
        os.path.join(root, file),
        os.path.relpath(os.path.join(root, file), os.path.join(path)),
      )

print("Ensuring libraries are installed...")
subprocess.call("npm i --omit=dev", shell=True)

print("Removing non-production libraries...")
subprocess.call("npm prune --omit=dev", shell=True)

print("Zipping files...")
with zipfile.ZipFile("lambda-bundle.zip", "w", zipfile.ZIP_DEFLATED) as zipf:
  zipdir("./", zipf)

print("Reinstalling all libraries...")
subprocess.call("npm i", shell=True)
