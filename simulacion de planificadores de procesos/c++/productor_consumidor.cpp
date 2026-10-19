// Problema Productor-Consumidor (buffer acotado) con hilos y semáforos (C++20)
// Mecanismo: 2 semáforos contadores (huecos / llenos) + 1 mutex para el buffer.
// Compilar: g++ -std=c++20 -O2 -pthread productor_consumidor.cpp -o productor_consumidor

#include <iostream>
#include <mutex>
#include <random>
#include <semaphore>
#include <string>
#include <thread>
#include <vector>
#include <chrono>

using namespace std;

const int TAM_BUFFER = 5;
const int PRODUCTORES = 2;
const int CONSUMIDORES = 3;
const int ITEMS_POR_PRODUCTOR = 6;
const int FIN = -1; // "pastilla venenosa" para avisar a los consumidores que terminen

// Buffer circular
int buffer[TAM_BUFFER];
int entrada = 0, salida = 0;

// Semáforos
counting_semaphore<> huecos(TAM_BUFFER); // espacios libres (bloquea a productores si es 0)
counting_semaphore<> llenos(0);          // items disponibles (bloquea a consumidores si es 0)

mutex mutexBuffer; // exclusión mutua sobre entrada/salida/buffer
mutex mutexSalida; // evita mezclar líneas de cout

void escribir(const string &texto)
{
    lock_guard<mutex> lock(mutexSalida);
    cout << texto << endl;
}

void poner(int item)
{
    huecos.acquire(); // espera un hueco libre
    {
        lock_guard<mutex> lock(mutexBuffer);
        buffer[entrada] = item;
        entrada = (entrada + 1) % TAM_BUFFER;
    }
    llenos.release(); // avisa que hay un item más
}

int sacar()
{
    llenos.acquire(); // espera un item
    int item;
    {
        lock_guard<mutex> lock(mutexBuffer);
        item = buffer[salida];
        salida = (salida + 1) % TAM_BUFFER;
    }
    huecos.release(); // avisa que hay un hueco más
    return item;
}

void productor(int id)
{
    mt19937 gen(random_device{}());
    uniform_int_distribution<int> espera(100, 400);
    for (int k = 1; k <= ITEMS_POR_PRODUCTOR; k++)
    {
        this_thread::sleep_for(chrono::milliseconds(espera(gen))); // "fabrica"
        int item = id * 100 + k;
        poner(item);
        escribir("Productor " + to_string(id) + ": produjo item " + to_string(item));
    }
}

void consumidor(int id)
{
    mt19937 gen(random_device{}());
    uniform_int_distribution<int> espera(300, 700);
    while (true)
    {
        int item = sacar();
        if (item == FIN)
            break;
        escribir("    Consumidor " + to_string(id) + ": consumió item " + to_string(item));
        this_thread::sleep_for(chrono::milliseconds(espera(gen))); // "procesa"
    }
    escribir("    Consumidor " + to_string(id) + ": termina");
}

int main()
{
    vector<thread> prods, cons;
    for (int i = 1; i <= PRODUCTORES; i++)
        prods.emplace_back(productor, i);
    for (int i = 1; i <= CONSUMIDORES; i++)
        cons.emplace_back(consumidor, i);

    for (auto &p : prods)
        p.join();

    // Ya no habrá más producción: un FIN por consumidor
    for (int i = 0; i < CONSUMIDORES; i++)
        poner(FIN);

    for (auto &c : cons)
        c.join();
    escribir("\nSimulación finalizada.");
}
