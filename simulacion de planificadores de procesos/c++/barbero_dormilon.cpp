// Problema del Barbero Dormilón con hilos y semáforos (C++20)
// Mecanismo: semáforos para la sincronización barbero<->cliente + mutex que
// protege el contador de clientes en espera.
// Compilar: g++ -std=c++20 -O2 -pthread barbero_dormilon.cpp -o barbero_dormilon

#include <chrono>
#include <iostream>
#include <mutex>
#include <random>
#include <semaphore>
#include <string>
#include <thread>
#include <vector>

using namespace std;

const int SILLAS = 3;         // sillas en la sala de espera
const int CLIENTES = 10;      // clientes que llegarán en total
const int CORTE_MS = 600;     // duración de un corte

// Semáforos
counting_semaphore<> clientesSem(0);    // clientes esperando (el barbero duerme si es 0)
counting_semaphore<> barberoListo(0);   // el barbero llama a un cliente
counting_semaphore<> corteTerminado(0); // el barbero avisa que terminó el corte

mutex mutexSala;       // protege 'esperando'
int esperando = 0;     // clientes sentados en la sala de espera
bool cerrar = false;   // se escribe solo cuando ya no llegarán más clientes
mutex mutexSalida;     // evita mezclar líneas de cout

void escribir(const string &texto)
{
    lock_guard<mutex> lock(mutexSalida);
    cout << texto << endl;
}

void barbero()
{
    while (true)
    {
        escribir("Barbero: duerme (sin clientes)");
        clientesSem.acquire(); // duerme hasta que llegue alguien
        if (cerrar)
            break;

        {
            lock_guard<mutex> lock(mutexSala);
            esperando--; // un cliente deja su silla
        }
        barberoListo.release(); // "siguiente"

        escribir("Barbero: corta el cabello");
        this_thread::sleep_for(chrono::milliseconds(CORTE_MS));
        escribir("Barbero: terminó el corte");
        corteTerminado.release();
    }
    escribir("Barbero: cierra la barbería");
}

void cliente(int id)
{
    string nombre = "    Cliente " + to_string(id);
    bool seSienta = false;
    {
        lock_guard<mutex> lock(mutexSala);
        if (esperando < SILLAS)
        {
            esperando++;
            seSienta = true;
            escribir(nombre + ": llega y se sienta (esperando: " + to_string(esperando) + ")");
        }
    }

    if (!seSienta)
    {
        escribir(nombre + ": sala llena, se va");
        return;
    }

    clientesSem.release();  // avisa al barbero (lo despierta si dormía)
    barberoListo.acquire(); // espera su turno
    escribir(nombre + ": se está cortando el cabello");
    corteTerminado.acquire(); // espera a que termine
    escribir(nombre + ": se va satisfecho");
}

int main()
{
    thread tb(barbero);

    mt19937 gen(random_device{}());
    uniform_int_distribution<int> llegada(100, 500);

    vector<thread> clientes;
    for (int i = 1; i <= CLIENTES; i++)
    {
        this_thread::sleep_for(chrono::milliseconds(llegada(gen)));
        clientes.emplace_back(cliente, i);
    }
    for (auto &c : clientes)
        c.join();

    cerrar = true;          // nadie más llegará
    clientesSem.release();  // despierta al barbero para que salga
    tb.join();
    escribir("\nSimulación finalizada.");
}
