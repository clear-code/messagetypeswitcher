PACKAGE_NAME = messagetypeswitcher

all: xpi

xpi: makexpi/makexpi.sh
	makexpi/makexpi.sh -n $(PACKAGE_NAME)

makexpi/makexpi.sh:
	git submodule update --init

signed: xpi
	makexpi/sign_xpi.sh -k $(JWT_KEY) -s $(JWT_SECRET) -p ./$(PACKAGE_NAME)_noupdate.xpi