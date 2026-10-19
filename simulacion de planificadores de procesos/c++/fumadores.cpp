// Problema de los Fumadores con hilos y semáforos reales (C++20)
// Compilar: g++ -std=c++20 -O2 -pthread fumadores.cpp -o fumadores

#include <iostream>
#include <mutex>
#include <random>
#include <semaphore>
#include <string>
#include <thread>
#include <vector>
#include <chrono>

using namespace std;

const int RONDAS = 9;     // rondas a completar
const int ETAPA_MS = 500; // duración de recoger / fumar

enum
{
    TABACO,
    PAPEL,
    CERILLAS
};
const char *NOMBRE[3] = {"Tabaco", "Papel", "Cerillas"};

// Semáforos
counting_semaphore<> agenteSem(1);                                 // turno del agente
counting_semaphore<> ingredienteSem[3] = {counting_semaphore<>(0), // agente -> empujadores
                                          counting_semaphore<>(0),
                                          counting_semaphore<>(0)};
counting_semaphore<> fumadorSem[3] = {counting_semaphore<>(0), // empujador -> fumador
                                      counting_semaphore<>(0),
                                      counting_semaphore<>(0)};

// Mutex y datos compartidos
mutex mutexEmpujadores; // protege hay[]
bool hay[3] = {false, false, false};
mutex mutexSalida;     // evita mezclar líneas de cout
bool terminar = false; // se escribe solo tras completar todas las rondas

void log(const string &texto)
{
    lock_guard<mutex> lock(mutexSalida);
    cout << texto << endl;
}

// El agente coloca dos ingredientes al azar y espera a que alguien fume.
void agente()
{
    mt19937 gen(random_device{}());
    for (int ronda = 1; ronda <= RONDAS; ronda++)
    {
        agenteSem.acquire(); // espera la mesa libre

        int falta = uniform_int_distribution<int>(0, 2)(gen);
        int a = (falta + 1) % 3, b = (falta + 2) % 3;

        log("\n--- Ronda " + to_string(ronda) + " ---");
        log(string("Agente: pone ") + NOMBRE[a] + " y " + NOMBRE[b]);

        ingredienteSem[a].release();
        ingredienteSem[b].release();
    }

    agenteSem.acquire(); // espera a que termine la última ronda
    terminar = true;
    for (int i = 0; i < 3; i++)
    { // despierta a los demás para que salgan
        ingredienteSem[i].release();
        fumadorSem[i].release();
    }
}

// Un empujador por ingrediente: decide qué fumador debe despertar.
void empujador(int i)
{
    int j = (i + 1) % 3, k = (i + 2) % 3;
    while (true)
    {
        ingredienteSem[i].acquire();
        if (terminar)
            return;

        lock_guard<mutex> lock(mutexEmpujadores);
        if (hay[j])
        {
            hay[j] = false;
            fumadorSem[k].release();
        } // faltaba k
        else if (hay[k])
        {
            hay[k] = false;
            fumadorSem[j].release();
        } // faltaba j
        else
        {
            hay[i] = true;
        } // espera al otro
    }
}

// El fumador i tiene el ingrediente i y necesita los otros dos.
void fumador(int i)
{
    string nombre = "Fumador " + to_string(i + 1) + " (" + NOMBRE[i] + ")";
    while (true)
    {
        fumadorSem[i].acquire();
        if (terminar)
            return;

        log(nombre + ": recoge los ingredientes");
        this_thread::sleep_for(chrono::milliseconds(ETAPA_MS));
        log(nombre + ": fuma");
        this_thread::sleep_for(chrono::milliseconds(ETAPA_MS));
        log(nombre + ": termina");

        agenteSem.release(); // devuelve el turno al agente
    }
}

int main()
{
    vector<thread> hilos;
    for (int i = 0; i < 3; i++)
        hilos.emplace_back(empujador, i);
    for (int i = 0; i < 3; i++)
        hilos.emplace_back(fumador, i);
    hilos.emplace_back(agente);

    for (auto &h : hilos)
        h.join();
    log("\nSimulación finalizada.");
}
