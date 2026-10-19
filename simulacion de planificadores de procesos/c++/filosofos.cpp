// Problema de los Filósofos Comensales con hilos (C++20)
// Mecanismo: MONITOR = mutex + condition_variable (una por filósofo).
// Un filósofo solo pasa a COMIENDO si ninguno de sus vecinos está COMIENDO,
// y toma ambos tenedores de forma atómica -> no hay interbloqueo.
// Compilar: g++ -std=c++20 -O2 -pthread filosofos.cpp -o filosofos

#include <chrono>
#include <condition_variable>
#include <iostream>
#include <mutex>
#include <random>
#include <string>
#include <thread>
#include <vector>

using namespace std;

const int N = 5;
const int COMIDAS = 3; // veces que come cada filósofo

enum Estado
{
    PENSANDO,
    HAMBRIENTO,
    COMIENDO
};

mutex mutexSalida;
void escribir(const string &texto)
{
    lock_guard<mutex> lock(mutexSalida);
    cout << texto << endl;
}

class Mesa
{
    mutex m;
    condition_variable cv[N];
    Estado estado[N] = {PENSANDO, PENSANDO, PENSANDO, PENSANDO, PENSANDO};

    static int izq(int i) { return (i + N - 1) % N; }
    static int der(int i) { return (i + 1) % N; }
    bool vecinosLibres(int i) const
    {
        return estado[izq(i)] != COMIENDO && estado[der(i)] != COMIENDO;
    }

public:
    void tomarTenedores(int i)
    {
        unique_lock<mutex> lock(m);
        estado[i] = HAMBRIENTO;
        cv[i].wait(lock, [&] { return vecinosLibres(i); }); // espera sin ocupar CPU
        estado[i] = COMIENDO;
    }

    void soltarTenedores(int i)
    {
        lock_guard<mutex> lock(m);
        estado[i] = PENSANDO;
        // Los vecinos podrían ahora poder comer
        cv[izq(i)].notify_one();
        cv[der(i)].notify_one();
    }
};

Mesa mesa;

void filosofo(int i)
{
    mt19937 gen(random_device{}());
    uniform_int_distribution<int> espera(200, 600);
    string nombre = "Filósofo " + to_string(i + 1);

    for (int k = 1; k <= COMIDAS; k++)
    {
        escribir(nombre + ": piensa");
        this_thread::sleep_for(chrono::milliseconds(espera(gen)));

        escribir(nombre + ": tiene hambre");
        mesa.tomarTenedores(i);

        escribir(nombre + ": COME (" + to_string(k) + "/" + to_string(COMIDAS) + ")");
        this_thread::sleep_for(chrono::milliseconds(espera(gen)));

        mesa.soltarTenedores(i);
        escribir(nombre + ": deja los tenedores");
    }
    escribir(nombre + ": terminó de cenar");
}

int main()
{
    vector<thread> hilos;
    for (int i = 0; i < N; i++)
        hilos.emplace_back(filosofo, i);
    for (auto &h : hilos)
        h.join();
    escribir("\nSimulación finalizada.");
}
