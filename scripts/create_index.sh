#!/bin/bash

set -e

ROOT=${1}

if [ -z ${ROOT} ]; then 
	echo "Root is missing"
	exit
fi

FILES="${ROOT}/*"
OUT="${ROOT}/index.txt"

touch "${OUT}"
echo -n > "${OUT}" # Empty file

for f in $FILES
do
  if [ "${f}" == "${OUT}" ]; then
		continue
  fi

  echo "Processing $f..."
  

  echo "${f}" >> "${OUT}"
done
