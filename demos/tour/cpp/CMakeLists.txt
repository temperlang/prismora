# Builds the tour against the C++ that `temper build -b cpp` generates at the
# repo's top:
#
#     cmake -B build && cmake --build build && ./build/tour

cmake_minimum_required(VERSION 3.16)
project(chromarite_tour CXX)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(TEMPER_OUT ${CMAKE_CURRENT_SOURCE_DIR}/../../../temper.out/cpp)

# Chromarite and the Temper std library it uses. std's main.cpp runs its tests.
file(GLOB STD_SOURCES ${TEMPER_OUT}/std/*.cpp)
list(FILTER STD_SOURCES EXCLUDE REGEX "/main\\.cpp$")
add_library(chromarite ${TEMPER_OUT}/chromarite/init.cpp ${STD_SOURCES})
target_include_directories(chromarite PUBLIC ${TEMPER_OUT})

add_executable(tour tour.cpp)
target_link_libraries(tour PRIVATE chromarite)
