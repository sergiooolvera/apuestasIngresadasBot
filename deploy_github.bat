@echo off
echo ====================================================
echo  Subiendo apuestasIngresadasBot a GitHub y Railway
echo ====================================================

git add .
git commit -m "update: sincronizacion de codigo para despliegue en Railway"
git push -u origin main

echo ====================================================
echo  Subida completada. Railway desplegara automaticamente.
echo ====================================================
pause
