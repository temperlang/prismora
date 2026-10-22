# Builds and runs the tour against the C++ that `temper build -b cpp`
# generates at the repo's top.

OUT := ../../../temper.out/cpp
CXXFLAGS := -std=c++14 -O1 -I $(OUT)
SOURCES := tour.cpp $(OUT)/prismora/init.cpp $(filter-out %/main.cpp,$(wildcard $(OUT)/std/*.cpp))
OBJECTS := $(patsubst %.cpp,build/%.o,$(notdir $(SOURCES)))

vpath %.cpp . $(OUT)/prismora $(OUT)/std

run: build/tour
	./build/tour

build/tour: $(OBJECTS)
	$(CXX) $^ -o $@

build/%.o: %.cpp | build
	$(CXX) $(CXXFLAGS) -c $< -o $@

build:
	mkdir -p build

clean:
	rm -rf build

.PHONY: run clean
