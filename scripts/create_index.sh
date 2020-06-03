#!/bin/bash

set -e

ROOT=${1}

if [ -z ${ROOT} ]; then 
	echo "Root is missing"
	exit
fi

FILES="${ROOT}/*"
OUT_FILENAME="index.txt"
OUT="${ROOT}/${OUT_FILENAME}"

touch "${OUT}"
echo -n > "${OUT}" # Empty file

for file in $FILES
do
  FILENAME="${file##*/}"

  if [ "${FILENAME}" == "${OUT_FILENAME}" ]; then
		continue
  fi

  echo "Processing ${FILENAME}..."
  

  echo "${FILENAME}" >> "${OUT}"
done
