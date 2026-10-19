// Problema Lectores-Escritores con hilos (C++20)
// Mecanismo: shared_mutex (cerrojo lector/escritor).
//   - shared_lock  -> varios lectores a la vez
//   - unique_lock  -> un escritor en exclusiva (sin lectores ni otros escritores)
// Compilar: g++ -std=c++20 -O2 -pthread lectores_escritores.cpp -o lectores_escritores

#include <atomic>
#include <chrono>
#include <iostream>
#include <mutex>
#include <random>
#include <shared_mutex>
#include <string>
#include <thread>
#include <vector>

using namespace std;

const int LECTORES = 4;
const int ESCRITORES = 2;
const int ITERACIONES = 4;

shared_mutex cerrojo; // protege 'dato'
int dato = 0;         // recurso compartido

atomic<int> lectoresActivos{0}; // solo para mostrar la concurrencia de lectores
mutex mutexSalida;

void escribir(const string &texto)
{
    lock_guard<mutex> lock(mutexSalida);
    cout << texto << endl;
}

void lector(int id)
{
    mt19937 gen(random_device{}());
    uniform_int_distribution<int> espera(50, 300);
    for (int k = 0; k < ITERACIONES; k++)
    {
        this_thread::sleep_for(chrono::milliseconds(espera(gen)));
        {
            shared_lock<shared_mutex> lock(cerrojo); // entran varios lectores
            int activos = ++lectoresActivos;
            escribir("Lector " + to_string(id) + ": lee dato = " + to_string(dato) +
                     "  (lectores activos: " + to_string(activos) + ")");
            this_thread::sleep_for(chrono::milliseconds(300)); // "lee"
            --lectoresActivos;
        }
    }
}

void escritor(int id)
{
    mt19937 gen(random_device{}());
    uniform_int_distribution<int> espera(200, 500);
    for (int k = 0; k < ITERACIONES; k++)
    {
        this_thread::sleep_for(chrono::milliseconds(espera(gen)));
        {
            unique_lock<shared_mutex> lock(cerrojo); // exclusión total
            escribir(">>> Escritor " + to_string(id) + ": entra a escribir (lectores activos: " +
                     to_string(lectoresActivos.load()) + ")");
            dato++;
            this_thread::sleep_for(chrono::milliseconds(400)); // "escribe"
            escribir(">>> Escritor " + to_string(id) + ": terminó, dato = " + to_string(dato));
        }
    }
}

int main()
{
    vector<thread> hilos;
    for (int i = 1; i <= LECTORES; i++)
        hilos.emplace_back(lector, i);
    for (int i = 1; i <= ESCRITORES; i++)
        hilos.emplace_back(escritor, i);

    for (auto &h : hilos)
        h.join();
    escribir("\nSimulación finalizada. Valor final = " + to_string(dato));
}
